import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import api from '../../../services/api';

export default function PaymentEvidenceImages({ paymentId, disabled, readOnly = false, onBusy, onUploaded }) {
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');
  const alive = useRef(true);
  const base = `/payments/${paymentId}/evidence-images`;

  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    api.get(base).then(({ data }) => { if (!cancelled) setImages(data); })
      .catch(() => { if (!cancelled) setError('Không tải được danh sách ảnh chứng từ. Hãy đóng và mở lại biểu mẫu để thử lại.'); });
    return () => { cancelled = true; alive.current = false; };
  }, [base]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || busy || disabled) return;
    setError('');
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size === 0 || file.size > 4 * 1024 * 1024) {
      setError('Chọn ảnh PNG hoặc JPEG, dung lượng tối đa 4 MB.');
      return;
    }
    setBusy(true);
    onBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post(base, form);
      if (!alive.current) return;
      setImages(items => items.some(item => item.id === data.id) ? items : [...items, data]);
      onUploaded();
    } catch (err) {
      if (alive.current) setError(err.response?.status === 409
        ? 'Giao dịch đã được xử lý, không thể thêm chứng từ.'
        : 'Không tải được ảnh. Kiểm tra ảnh PNG/JPEG tối đa 4 MB, 20 triệu điểm ảnh và không quá 10 ảnh mỗi giao dịch, rồi thử lại.');
    } finally {
      onBusy(false);
      if (alive.current) setBusy(false);
    }
  }

  async function view(id) {
    setError('');
    try {
      const { data } = await api.get(`${base}/${id}`, { responseType: 'blob' });
      if (alive.current) setPreview(URL.createObjectURL(data));
    } catch {
      if (alive.current) setError('Không mở được ảnh chứng từ. Vui lòng thử lại.');
    }
  }

  return <div className="mb-3">
    {!readOnly && <Form.Group controlId="rec-evidence-image">
      <Form.Label>Ảnh chứng từ đối soát</Form.Label>
      <Form.Control type="file" accept="image/png,image/jpeg" onChange={upload} disabled={disabled || busy || images.length >= 10} />
      <Form.Text>PNG/JPEG tối đa 4 MB mỗi ảnh, tối đa 10 ảnh. Ảnh được lưu với giao dịch; chỉ Quản lý và Lễ tân được xem.</Form.Text>
    </Form.Group>}
    {busy && <div role="status"><Spinner size="sm" /> Đang tải ảnh…</div>}
    {error && <Alert variant="danger" className="mt-2">{error}</Alert>}
    <div className="d-flex flex-wrap gap-2 mt-2">
      {images.map((item, index) => <Button key={item.id} size="sm" variant="outline-secondary" onClick={() => view(item.id)}>Xem chứng từ {index + 1}</Button>)}
    </div>
    {preview && <div className="mt-2"><img src={preview} alt="Ảnh chứng từ đối soát" style={{ maxWidth: '100%', maxHeight: 360, objectFit: 'contain' }} /></div>}
  </div>;
}
