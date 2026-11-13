import com.scms.backend.qa.*;
import com.scms.backend.account.AccountRole;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import java.net.*;
import java.net.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.ObjectMapper;

/** FE-owned fixture layer; reuses the pinned backend's test JVM and schema migration launcher. */
public final class CourseRuntimeEnvironment {
 public static void main(String[] args) throws Exception {
  TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
  Path dir=Path.of(args[0]).toAbsolutePath(); Files.createDirectories(dir);
  var json=new ObjectMapper();
  try(var postgres=new PostgreSQLContainer("postgres:17")) {
   postgres.start();
   try(var app=new CourseQaProcess(dir,postgres)) {
    app.start();
    var db=new JdbcTemplate(new DriverManagerDataSource(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword()));
    var fixture=new CourseQaFixtures(db);
    var people=new LinkedHashMap<String,Object>();
    for(var entry:Map.of("manager",AccountRole.MANAGER,"reception",AccountRole.RECEPTIONIST,"coach",AccountRole.COACH,"coach2",AccountRole.COACH,"member",AccountRole.MEMBER,"member2",AccountRole.MEMBER).entrySet()) {
     UUID id=fixture.account(entry.getKey(),entry.getValue());
     var person=new LinkedHashMap<String,Object>();person.put("accountId",id);
     if(entry.getValue()==AccountRole.MEMBER) person.put("memberCode",db.queryForObject("select member_code from member_profiles where account_id=?",String.class,id));
     people.put(entry.getKey(),person);
    }
    db.update("update accounts set status='INACTIVE' where id=?",fixture.account("inactive",AccountRole.MEMBER));
    var payments=new LinkedHashMap<String,Object>();
    UUID member=fixture.account("member",AccountRole.MEMBER);
    for(String scenario:List.of("cash","reconcile","withdraw","attendance","transfer","waitlist","legacy")) payments.put(scenario,fixture.payment(member,Instant.now().plusSeconds(600),scenario.equals("reconcile"),10));
    // Historical legacy state exists only in initial disposable fixtures, never in tested transitions.
    var legacy=(CourseQaFixtures.Payment)payments.get("legacy");
    var http=HttpClient.newHttpClient();
    var login=http.send(HttpRequest.newBuilder(URI.create(app.base()+"/auth/login")).header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(Map.of("identifier","reception@course-qa.invalid","password",CourseQaFixtures.PASSWORD)))).build(),HttpResponse.BodyHandlers.ofString());
    if(login.statusCode()!=200) throw new AssertionError("Fixture login failed: "+login.statusCode());
    var paid=http.send(HttpRequest.newBuilder(URI.create(app.base()+"/reception/members/"+member+"/course-orders/"+legacy.orderId()+"/payments/cash")).header("Authorization","Bearer "+json.readTree(login.body()).get("accessToken").asText()).header("Idempotency-Key","legacy-initial-fixture").POST(HttpRequest.BodyPublishers.noBody()).build(),HttpResponse.BodyHandlers.ofString());
    if(paid.statusCode()!=200) throw new AssertionError("Fixture cash failed: "+paid.statusCode());
    UUID enrollment=UUID.fromString(json.readTree(paid.body()).get("enrollmentId").asText());
    UUID legacyRequest=UUID.randomUUID();
    new org.springframework.transaction.support.TransactionTemplate(new org.springframework.jdbc.datasource.DataSourceTransactionManager(db.getDataSource())).executeWithoutResult(status -> {
    db.execute("alter table course_withdrawal_requests disable trigger course_withdrawal_snapshot");
    db.update("insert into course_withdrawal_requests(id,course_enrollment_id,course_run_id,member_account_id,requester_account_id,status,request_reason,requested_at,cancelled_at,cancellation_reason) values(?,?,?,?,?,'CANCELLED','QA legacy historical request',current_timestamp,current_timestamp,'LEGACY_SNAPSHOT_MISSING')",legacyRequest,enrollment,legacy.runId(),member,member);
    db.execute("alter table course_withdrawal_requests enable trigger course_withdrawal_snapshot");
    });
    if(!"O".equals(db.queryForObject("select tgenabled from pg_trigger where tgname='course_withdrawal_snapshot'",String.class))) throw new AssertionError("Snapshot enforcement must be enabled before UI tests");
    Files.writeString(dir.resolve("environment.json"),json.writeValueAsString(Map.of("backendUrl",app.base(),"backendPid",app.process.pid(),"backendSha",System.getenv("SCMS_QA_BACKEND_SHA"),"accounts",people,"fixtures",payments,"legacyRequestId",legacyRequest)));
    CourseQaProcess.await(()->Files.exists(dir.resolve("stop")),Duration.ofMinutes(30));
    var counts=db.queryForList("select o.id as order_id,(select count(*) from course_enrollments e where e.course_order_id=o.id) as enrollments,(select count(*) from course_payments p where p.course_order_id=o.id and p.status='PAID') as paid_payments,(select count(*) from audit_events a join course_payments p on p.id=a.target_id where p.course_order_id=o.id and a.action='COURSE_PAYMENT_RECONCILED') as reconciliation_audits,(select count(*) from notification_outbox n where n.payload->>'orderId'=o.id::text and n.notification_type='COURSE_ENROLLMENT_CREATED') as enrollment_notifications,(select count(*) from course_enrollment_sessions es join course_enrollments e on e.id=es.course_enrollment_id where e.course_order_id=o.id) as allocations from course_orders o order by o.id");
    Files.writeString(dir.resolve("database-counts.json"),json.writeValueAsString(counts));
    Files.writeString(dir.resolve("withdrawal-refund-progress.json"),json.writeValueAsString(db.queryForList("select w.id withdrawal_id,w.status withdrawal_status,r.id refund_id,r.status refund_status,r.disbursed_amount_vnd,r.verified_amount_vnd from course_withdrawal_requests w join course_refund_obligations r on r.course_enrollment_id=w.course_enrollment_id and r.source_event_id is null and r.source_type=case when w.cause_code='VOLUNTARY' then 'MEMBER_WITHDRAWAL' else 'MATERIAL_CHANGE' end where w.status='APPROVED'")));

    for(var row:counts) if(((Number)row.get("enrollments")).longValue()>1 || ((Number)row.get("paid_payments")).longValue()>1 || ((Number)row.get("reconciliation_audits")).longValue()>1 || ((Number)row.get("enrollment_notifications")).longValue()>1) throw new AssertionError("Duplicate fulfillment in disposable database");
   }
  }
 }
}
