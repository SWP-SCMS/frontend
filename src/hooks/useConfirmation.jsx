import { useEffect, useRef, useState } from "react";
import { Button, Modal } from "react-bootstrap";

// Chỉ tiếp tục thao tác sau khi người dùng xác nhận; ref chặn hai yêu cầu đồng thời.
export default function useConfirmation() {
  const [message, setMessage] = useState("");
  const resolver = useRef(null);
  useEffect(() => () => { resolver.current?.(false); resolver.current = null; }, []);
  function confirm(message) {
    if (resolver.current) return Promise.resolve(false);
    setMessage(message);
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }
  function finish(answer) {
    const resolve = resolver.current;
    resolver.current = null;
    setMessage("");
    resolve?.(answer);
  }
  const dialog = (
    <Modal show={Boolean(message)} onHide={() => finish(false)} centered>
      <Modal.Header closeButton>
        <Modal.Title>Xác nhận thao tác</Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ whiteSpace: "pre-line" }}>{message}</Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={() => finish(false)}>
          Quay lại
        </Button>
        <Button variant="danger" onClick={() => finish(true)}>
          Xác nhận
        </Button>
      </Modal.Footer>
    </Modal>
  );
  return { confirm, dialog };
}
