import { Children, isValidElement } from 'react';
import { statusTone, variantTone } from '../../utils/statusTone';
function labelText(children) {
  return Children.toArray(children).map(child => isValidElement(child) ? labelText(child.props.children) : String(child)).join(' ');
}
export default function SystemBadge({ children, bg, text: _text, pill: _pill, tone, className = '', as: Tag = 'span', ...props }) {
  const legacy = className.match(/(?:bg-|text-bg-)(success|danger|warning|primary|info|secondary|light|dark)/)?.[1];
  const resolved = tone || statusTone(labelText(children), variantTone[bg || legacy] || 'neutral');
  return <Tag {...props} className={`badge system-badge system-badge--${resolved} ${className}`}>{children}</Tag>;
}
