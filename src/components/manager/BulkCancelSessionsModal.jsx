import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Form, Modal, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import ErrorAlert from '../common/ErrorAlert';
import {
  bulkCancelSessions,
  previewSessionCancellation,
} from '../../services/classSessionService';
import { formatGymDate, formatGymTime } from '../../utils/gymTime';
import { applyServerErrors } from '../../utils/serverErrors';

const schema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập lý do hủy.')
    .max(1000, 'Lý do không được vượt quá 1000 ký tự.'),
});

function sameIds(left, right) {
  const a = [...left].sort();
  const b = [...right].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export default function BulkCancelSessionsModal({
  show,
  sessions = [],
  onHide,
  onApplied,
}) {
  const requestedIds = useMemo(
    () => sessions.map((session) => session.id).filter(Boolean),
    [sessions],
  );
  const sessionById = useMemo(
    () => new Map(sessions.map((session) => [session.id, session])),
    [sessions],
  );
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [notice, setNotice] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { reason: '' },
  });

  useEffect(() => {
    if (!show) return undefined;
    let cancelled = false;
    reset({ reason: '' });
    setPreview(null);
    setServerError(null);
    setNotice(null);
    setPreviewing(true);
    previewSessionCancellation({ sessionIds: requestedIds })
      .then((value) => {
        if (!cancelled) setPreview(value);
      })
      .catch((error) => {
        if (!cancelled) setServerError(error);
      })
      .finally(() => {
        if (!cancelled) setPreviewing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [requestedIds, reset, show]);

  async function onSubmit(data) {
    setServerError(null);
    setNotice(null);
    try {
      const freshPreview = await previewSessionCancellation({
        sessionIds: requestedIds,
      });
      if (!sameIds(freshPreview.sessionIds, preview?.sessionIds || [])) {
        setPreview(freshPreview);
        setNotice(
          'Danh sách buổi đủ điều kiện đã thay đổi. Vui lòng kiểm tra lại kết quả xem trước rồi xác nhận lần nữa.',
        );
        return;
      }
      if (freshPreview.count === 0) {
        setPreview(freshPreview);
        setNotice('Không còn buổi tập nào đủ điều kiện để hủy.');
        return;
      }
      const result = await bulkCancelSessions({
        sessionIds: freshPreview.sessionIds,
        reason: data.reason.trim(),
      });
      if (result.cancelledCount === 0) {
        setNotice('Không còn buổi tập nào đủ điều kiện để hủy.');
        return;
      }
      onApplied(result);
    } catch (error) {
      if (error?.response?.data?.code === 'SESSION_BULK_SELECTION_CHANGED') {
        const eligibleSessionIds = Array.isArray(
          error.response.data.eligibleSessionIds,
        )
          ? error.response.data.eligibleSessionIds
          : [];
        const ineligibleSessionIds = Array.isArray(
          error.response.data.ineligibleSessionIds,
        )
          ? error.response.data.ineligibleSessionIds
          : [];
        setPreview({
          count: eligibleSessionIds.length,
          sessionIds: eligibleSessionIds,
        });
        setNotice(
          ineligibleSessionIds.length > 0
            ? `${ineligibleSessionIds.length} buổi vừa thay đổi trạng thái. Danh sách đủ điều kiện đã được cập nhật; vui lòng kiểm tra và xác nhận lại.`
            : 'Danh sách đủ điều kiện đã thay đổi. Vui lòng kiểm tra và xác nhận lại.',
        );
        return;
      }
      const handled = applyServerErrors(error, setError, {
        fields: ['reason'],
      });
      if (!handled) setServerError(error);
    }
  }

  const eligibleIds = preview?.sessionIds || [];

  return (
    <Modal show={show} onHide={isSubmitting ? undefined : onHide} centered size="lg">
      <Form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Modal.Header closeButton={!isSubmitting}>
          <Modal.Title className="h5">Hủy nhiều buổi tập</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small">
            Hệ thống chỉ hủy các buổi trong tương lai đang ở trạng thái
            SCHEDULED. Kết quả áp dụng từ backend là nguồn xác nhận cuối cùng.
          </p>
          <ErrorAlert
            error={serverError}
            title="Không xử lý được yêu cầu hủy"
            onClose={() => setServerError(null)}
          />
          {notice ? <Alert variant="warning">{notice}</Alert> : null}
          {previewing ? (
            <div className="text-center py-4">
              <Spinner animation="border" variant="danger" />
            </div>
          ) : preview ? (
            <>
              <Alert variant={preview.count > 0 ? 'info' : 'warning'}>
                Có <strong>{preview.count}</strong> buổi tập đủ điều kiện hủy.
              </Alert>
              {eligibleIds.length > 0 ? (
                <ul className="small">
                  {eligibleIds.map((id) => {
                    const session = sessionById.get(id);
                    return (
                      <li key={id} className="mb-1">
                        <Link to={`/manager/class-sessions/${id}`}>
                          {session?.className || id}
                        </Link>
                        {session?.startTime ? (
                          <span className="text-muted">
                            {' — '}
                            {formatGymDate(session.startTime)} ·{' '}
                            {formatGymTime(session.startTime)}
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </>
          ) : null}
          <Form.Group controlId="bulk-cancel-reason">
            <Form.Label>Lý do hủy *</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              maxLength={1000}
              {...register('reason')}
              isInvalid={Boolean(errors.reason)}
            />
            <Form.Control.Feedback type="invalid">
              {errors.reason?.message}
            </Form.Control.Feedback>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onHide} disabled={isSubmitting}>
            Đóng
          </Button>
          <Button
            type="submit"
            variant="danger"
            disabled={isSubmitting || previewing || !preview || preview.count === 0}
          >
            {isSubmitting ? 'Đang hủy…' : 'Xác nhận hủy'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
