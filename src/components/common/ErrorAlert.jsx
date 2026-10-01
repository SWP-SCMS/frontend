import { Alert } from 'react-bootstrap';
import { extractErrorMessage } from '../../utils';

export default function ErrorAlert({ error, title = 'Đã có lỗi xảy ra', onClose }) {
  if (!error) return null;
  const message = extractErrorMessage(error, title);
  return (
    <Alert variant="danger" dismissible={Boolean(onClose)} onClose={onClose}>
      <Alert.Heading className="h6 mb-1">{title}</Alert.Heading>
      <div>{message}</div>
    </Alert>
  );
}
