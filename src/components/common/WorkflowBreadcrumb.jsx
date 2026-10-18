import { Link } from 'react-router-dom';
import './WorkflowBreadcrumb.css';

export default function WorkflowBreadcrumb({ items = [], current }) {
  return (
    <nav className="scms-workflow-breadcrumb" aria-label="Điều hướng phân cấp">
      {items.map((item) => (
        <span className="scms-workflow-breadcrumb-part" key={`${item.to}-${item.label}`}>
          <Link to={item.to}>{item.label}</Link>
          <span aria-hidden="true">›</span>
        </span>
      ))}
      <strong aria-current="page">{current}</strong>
    </nav>
  );
}
