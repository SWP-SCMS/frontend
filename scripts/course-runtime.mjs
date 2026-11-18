import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, openSync, closeSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const backend = path.resolve(process.env.COURSE_QA_BACKEND || '../backend');
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: backend, encoding: 'utf8' }).trim();
// Use the same pin as checkout in CI, so updating it cannot silently drift here.
const workflow = readFileSync(path.resolve('.github/workflows/ci.yml'), 'utf8');
const expected = workflow.match(/repository:\s*SWP-SCMS\/backend\s*\r?\n\s*ref:\s*([a-f0-9]{40})\b/i)?.[1];
if (!expected) throw new Error('CI must pin SWP-SCMS/backend to a full commit SHA.');
if (sha !== expected) throw new Error(`Backend must be pinned to ${expected}; found ${sha}`);
const dir = path.resolve('.course-qa', `runtime-${Date.now()}`);
mkdirSync(dir, { recursive: true });
const compiled = path.join(dir, 'classes');
mkdirSync(compiled, { recursive: true });
const backendCp = [path.join(backend, 'target/test-classes'), path.join(backend, 'target/classes'), readFileSync(path.join(backend, 'target/qa-classpath.txt'), 'utf8').trim()].join(path.delimiter);
const compileArgs = path.join(dir, 'javac.args');
writeFileSync(compileArgs, '-encoding UTF-8\n-cp\n' + JSON.stringify(backendCp.replaceAll('\\', '/')) + '\n-d\n' + JSON.stringify(compiled.replaceAll('\\', '/')) + '\n' + JSON.stringify(path.resolve('tests/runtime/java/CourseRuntimeEnvironment.java').replaceAll('\\', '/')));
execFileSync('javac', ['@' + compileArgs], { stdio: 'inherit' });
const cp = compiled + path.delimiter + backendCp;
const args = path.join(dir, 'launcher.args');
writeFileSync(args, `-Xmx256m\n-cp\n"${cp.replaceAll('\\', '/')}"\nCourseRuntimeEnvironment\n"${dir.replaceAll('\\', '/')}"\n`);
const log = openSync(path.join(dir, 'owner.log'), 'w');
const owner = spawn('java', [`@${args}`], { cwd: backend, env: { ...process.env, SCMS_QA_BACKEND_SHA: sha, SPRING_APPLICATION_JSON: JSON.stringify({ 'scms.course-reservation-expiry-initial-delay-ms': 86400000 }) }, stdio: ['ignore', log, log], windowsHide: true });
const exited = new Promise(resolve => owner.once('exit', resolve));
try {
  const deadline = Date.now() + 120000;
  while (!existsSync(path.join(dir, 'environment.json'))) {
    if (owner.exitCode !== null || Date.now() > deadline) throw new Error(`QA environment failed; see ${dir}/owner.log`);
    await delay(200);
  }
  writeFileSync(path.join(dir, 'sources.json'), JSON.stringify({ backendSha: sha, frontendSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), frontendDirty: !!execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim(), clock: 'SYSTEM_CLOCK; individual temporal tests explicitly use CONTROLLED_CLOCK' }, null, 2));
  const cli = path.resolve('node_modules/@playwright/test/cli.js');
  const tests = spawn(process.execPath, [cli, 'test', '--config=playwright.runtime.config.js', ...process.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, COURSE_QA_DIRECTORY: dir }, windowsHide: true });
  process.exitCode = await new Promise(resolve => tests.once('exit', code => resolve(code ?? 1)));
} finally {
  writeFileSync(path.join(dir, 'stop'), 'owner requested teardown');
  const stopped = await Promise.race([exited.then(() => true), delay(20000).then(() => false)]);
  if (!stopped) { owner.kill(); process.exitCode = 1; }
  else if (owner.exitCode !== 0) process.exitCode = 1;
  closeSync(log);
}
