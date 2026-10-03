// Dữ liệu dùng chung cho khu vực Hội viên: danh sách Membership của chính
// Member. MemberLayout tải 1 lần rồi chia sẻ cho sidebar và các trang con
// (Dashboard...), tránh mỗi nơi tự gọi API một lần.

import { createContext, useContext } from 'react';

export const MemberAreaContext = createContext(null);

export function useMemberArea() {
  const ctx = useContext(MemberAreaContext);
  if (!ctx) {
    throw new Error('useMemberArea must be used within <MemberLayout>.');
  }
  return ctx;
}
