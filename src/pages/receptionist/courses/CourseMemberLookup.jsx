import { Button, Form } from 'react-bootstrap';

export default function CourseMemberLookup({ register, errors, onSubmit, disabled }) {
  return (
<Form className="scms-course-member-search" noValidate onSubmit={onSubmit}>
      <Form.Label htmlFor="course-member-kind">Tra cứu hội viên</Form.Label>
      <Form.Select id="course-member-kind" {...register('kind')} disabled={disabled}>
        <option value="memberId">Mã hội viên</option><option value="phone">Số điện thoại</option>
      </Form.Select>
      <Form.Control className="my-2" aria-label="Mã hội viên hoặc số điện thoại" {...register('query')} isInvalid={!!errors.query} disabled={disabled} />
      <Form.Control.Feedback type="invalid">{errors.query?.message}</Form.Control.Feedback>
      <Button type="submit" disabled={disabled}>Tra cứu</Button>
    </Form>
  );
}
