const LABELS = {
  title: 'Tiêu đề',
  status: 'Trạng thái',
  goal: 'Mục tiêu',
  exercise: 'Bài tập',
  exercises: 'Bài tập',
  sets: 'Số hiệp',
  reps: 'Số lần',
  weight: 'Mức tạ',
  duration: 'Thời lượng',
  note: 'Ghi chú',
  notes: 'Ghi chú',
  comment: 'Nhận xét',
  rating: 'Đánh giá',
  result: 'Kết quả',
};

const HIDDEN_KEYS = new Set([
  'id',
  'memberAccountId',
  'coachAccountId',
  'trainingPlanId',
  'trainingResultId',
  'feedbackId',
]);

function labelFor(key) {
  if (LABELS[key]) return LABELS[key];
  const spaced = key.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ');
  return spaced.charAt(0).toLocaleUpperCase('vi-VN') + spaced.slice(1);
}

function normalize(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function Value({ value }) {
  const normalized = normalize(value);
  if (normalized == null || normalized === '') return <span className="text-muted">—</span>;
  if (Array.isArray(normalized)) {
    return (
      <ul className="mb-0 ps-3">
        {normalized.map((item, index) => <li key={index}><Value value={item} /></li>)}
      </ul>
    );
  }
  if (typeof normalized === 'object') {
    const entries = Object.entries(normalized).filter(([key]) => !HIDDEN_KEYS.has(key));
    return (
      <dl className="row mb-0">
        {entries.map(([key, item]) => (
          <div className="col-12 mb-2" key={key}>
            <dt className="small text-muted fw-normal">{labelFor(key)}</dt>
            <dd className="mb-0"><Value value={item} /></dd>
          </div>
        ))}
      </dl>
    );
  }
  if (typeof normalized === 'boolean') return normalized ? 'Có' : 'Không';
  return String(normalized);
}

export default function TrainingContent({ value }) {
  return <Value value={value} />;
}
