import PublicDarkLayout from './PublicDarkLayout';

export default function CourseCatalogLayout({ memberView, children }) {
  return memberView
    ? <div className="member-course-catalog">{children}</div>
    : <PublicDarkLayout active="courses">{children}</PublicDarkLayout>;
}
