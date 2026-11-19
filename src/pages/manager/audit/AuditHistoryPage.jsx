import usePollingEffect from '../../../hooks/usePollingEffect';
import { courseReasonLabel } from '../../../utils/courseReasonLabels';
import { COURSE_REFUND_SOURCE_LABELS } from '../../../utils/courseWorkflow';
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Card, Col, Form, Row, Spinner, Table } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { RhfDateInput } from '../../../components/common/DateInput';
import { z } from 'zod';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { listAuditEvents } from '../../../services/auditService';
import { formatGymDate, formatGymTime } from '../../../utils/gymTime';

const ACTION_LABELS = {
  COURSE_APPROVED: 'Duyệt khóa học',
  COURSE_REJECTED: 'Từ chối khóa học',
  COURSE_RUN_SCHEDULE_CHANGED: 'Thay đổi lịch đợt học',
  MEMBERSHIP_FREEZE_CASH_PAID: 'Thanh toán phí đóng băng bằng tiền mặt',
  ACCOUNT_EMAIL_CHANGE_CANCELLED: "Hủy yêu cầu đổi email",
  ACCOUNT_EMAIL_CHANGE_EXPIRED: "Yêu cầu đổi email hết hạn",
  ACCOUNT_EMAIL_CHANGE_RESENT: "Gửi lại mã xác minh đổi email",
  ACCOUNT_EMAIL_CHANGE_SUPERSEDED: "Thay thế yêu cầu đổi email",
  COACH_LEAVE_EXPIRED: "Yêu cầu nghỉ của huấn luyện viên hết hạn",
  COURSE_ATTENDANCE_CHANGED: "Cập nhật điểm danh khóa học",
  COURSE_PAYMENT_RECONCILED: "Đối soát thanh toán khóa học",
  COURSE_RESERVATION_EXPIRED: "Giữ chỗ khóa học hết hạn",
  COURSE_RUN_COMPLETED: "Hoàn tất đợt học",
  COURSE_RUN_RESCHEDULED: "Đổi lịch đợt học",
  COURSE_SCHEDULE_CHANGE_RESPONDED: "Phản hồi thay đổi lịch khóa học",
  COURSE_TRANSFER_ACCEPTED: "Chấp nhận đề nghị chuyển đợt học",
  COURSE_WAITLIST_ACCEPTED: "Chấp nhận chỗ học từ hàng chờ",
  COURSE_WAITLIST_CANCELLED: "Hủy hàng chờ khóa học",
  COURSE_WAITLIST_JOINED: "Tham gia hàng chờ khóa học",
  COURSE_WAITLIST_LEFT: "Rời hàng chờ khóa học",
  COURSE_WITHDRAWAL_CANCELLED: "Hủy yêu cầu rút khóa học",
  EMAIL_VERIFIED: "Xác minh email thành công",
  MEMBERSHIP_FREEZE_ACTIVATED: "Bắt đầu đóng băng gói tập",
  PASSWORD_RESET_OTP_RESENT: "Gửi lại mã xác minh đặt lại mật khẩu",
  PASSWORD_RESET_OTP_VERIFIED: "Xác minh mã đặt lại mật khẩu",
  TRAINING_PLAN_ARCHIVED: "Lưu trữ kế hoạch tập luyện",
  TRAINING_PLAN_REPLACED: "Thay thế kế hoạch tập luyện",
  WAITLIST_JOINED: "Tham gia hàng chờ buổi tập",
  WAITLIST_LEFT: "Rời hàng chờ buổi tập",
  COURSE_CREATED: 'Tạo khóa học', COURSE_UPDATED: 'Cập nhật khóa học', COURSE_PUBLISHED: 'Công khai khóa học',
  COURSE_DEACTIVATED: 'Ngừng hoạt động khóa học', COURSE_ARCHIVED: 'Lưu trữ khóa học',
  COURSE_RUN_CREATED: 'Tạo đợt học', COURSE_RUN_UPDATED: 'Cập nhật đợt học', COURSE_RUN_OPENED: 'Mở đăng ký đợt học',
  COURSE_RUN_CANCELLED: 'Hủy đợt học', COURSE_RUN_CONFIRMED: 'Xác nhận mở lớp', COURSE_RUN_SETTLEMENT_PENDING: 'Đợt học chờ quyết toán',
  COURSE_SESSION_CREATED: 'Tạo buổi khóa học', COURSE_SESSION_RESCHEDULED: 'Đổi lịch buổi khóa học',
  COURSE_SESSION_CANCELLED: 'Hủy buổi khóa học', COURSE_SESSION_MAKEUP_SCHEDULED: 'Xếp buổi học bù',
  COURSE_ORDER_CREATED: 'Tạo đơn khóa học', COURSE_PAYMENT_PAID: 'Thanh toán khóa học', COURSE_ENROLLMENT_CREATED: 'Ghi danh khóa học',
  COURSE_WITHDRAWAL_REQUESTED: 'Yêu cầu rút khóa học', COURSE_WITHDRAWAL_APPROVED: 'Duyệt rút khóa học', COURSE_WITHDRAWAL_REJECTED: 'Từ chối rút khóa học',
  COURSE_TRANSFER_REQUESTED: 'Yêu cầu chuyển đợt học', COURSE_TRANSFER_APPROVED: 'Duyệt chuyển đợt học', COURSE_TRANSFER_REJECTED: 'Từ chối chuyển đợt học', COURSE_TRANSFER_COMPLETED: 'Hoàn tất chuyển đợt học',
  COURSE_REFUND_APPROVED: 'Duyệt hoàn tiền khóa học', COURSE_REFUND_REJECTED: 'Từ chối hoàn tiền khóa học',
  COURSE_REFUND_DISBURSED: 'Ghi nhận chi hoàn tiền khóa học', COURSE_REFUND_VERIFIED: 'Xác minh hoàn tiền khóa học', COURSE_REFUND_FAILED: 'Hoàn tiền khóa học thất bại', COURSE_REFUND_RETURNED: 'Tiền hoàn khóa học bị trả lại',
  ACCOUNT_ACTIVATED: 'Kích hoạt tài khoản',
  ACCOUNT_ACTIVATED_MANUALLY: 'Kích hoạt tài khoản tại quầy',
  ACCOUNT_CREATED: 'Tạo tài khoản',
  ACCOUNT_CREATED_PENDING_EMAIL_VERIFICATION: 'Tạo tài khoản, chờ xác minh email',
  ACCOUNT_REGISTRATION_REVIVED: 'Khôi phục đăng ký tài khoản',
  INITIAL_MANAGER_PROVISIONED: 'Khởi tạo tài khoản quản lý',
  EMAIL_VERIFICATION_BYPASSED: 'Bỏ qua xác minh email',
  EMAIL_VERIFICATION_REGISTRATION_EXPIRED: 'Đăng ký hết hạn xác minh email',
  MANUAL_ACTIVATION_REQUEST_APPROVED: 'Duyệt yêu cầu kích hoạt tài khoản',
  MANUAL_ACTIVATION_REQUEST_CANCELLED: 'Hủy yêu cầu kích hoạt tài khoản',
  MANUAL_ACTIVATION_REQUEST_EXPIRED: 'Yêu cầu kích hoạt tài khoản hết hạn',
  MANUAL_ACTIVATION_REQUEST_REJECTED: 'Từ chối yêu cầu kích hoạt tài khoản',
  MANUAL_ACTIVATION_REQUESTED: 'Gửi yêu cầu kích hoạt tài khoản',
  MEMBER_SUSPENDED: 'Tạm khóa tài khoản hội viên',
  MEMBER_REACTIVATED: 'Mở lại tài khoản hội viên',
  STAFF_DEACTIVATED: 'Vô hiệu hóa tài khoản nhân viên',
  STAFF_SELF_PROFILE_UPDATED: 'Nhân viên tự cập nhật hồ sơ',
  PASSWORD_RESET: 'Đặt lại mật khẩu',
  PASSWORD_RESET_REQUESTED: 'Yêu cầu đặt lại mật khẩu',
  PASSWORD_RESET_COMPLETED: 'Hoàn tất đặt lại mật khẩu',
  PASSWORD_RESET_EXPIRED: 'Yêu cầu đặt lại mật khẩu hết hạn',
  PASSWORD_RESET_FAILED: 'Đặt lại mật khẩu thất bại',
  ACCOUNT_EMAIL_CHANGE_REQUESTED: 'Gửi yêu cầu đổi email tài khoản',
  ACCOUNT_EMAIL_CHANGE_COMPLETED: 'Đổi email tài khoản',
  EMAIL_DELIVERY_TERMINAL_FAILED: 'Gửi email thất bại sau nhiều lần thử',
  DISCIPLINE_CREATED: 'Tạo bộ môn',
  DISCIPLINE_UPDATED: 'Cập nhật bộ môn',
  SESSION_CANCELLED: 'Hủy buổi tập',
  SESSION_ROOM_CHANGED: 'Đổi phòng tập',
  SESSION_RESCHEDULED: 'Đổi lịch buổi tập',
  ROOM_CREATED: 'Tạo phòng tập',
  ROOM_UPDATED: 'Cập nhật phòng tập',
  ROOM_SUSPENDED: 'Tạm ngưng phòng tập',
  ROOM_REACTIVATED: 'Mở lại phòng tập',
  ROOM_SUSPENSION_EXTENDED: 'Gia hạn thời gian tạm ngưng phòng',
  COACH_ASSIGNED: 'Phân công huấn luyện viên',
  COACH_REASSIGNED: 'Đổi huấn luyện viên',
  COACH_ASSIGNMENT_ENDED: 'Kết thúc phân công huấn luyện viên',
  SESSION_ASSIGNMENT_CHANGED: 'Thay đổi phân công buổi tập',
  WAITLIST_PROMOTED: 'Chuyển hội viên từ hàng chờ sang lịch đặt',
  WAITLIST_CANCELLED: 'Hủy lượt trong hàng chờ',
  WAITLIST_SKIPPED: 'Bỏ qua lượt trong hàng chờ',
  WAITLIST_EXPIRED: 'Lượt trong hàng chờ hết hạn',
  PT_WAITLIST_CANCELLED: 'Hủy hàng chờ buổi tập PT',
  ATTENDANCE_CHANGED: 'Cập nhật điểm danh',
  COACH_LEAVE_REQUESTED: 'Gửi yêu cầu nghỉ của huấn luyện viên',
  COACH_LEAVE_WITHDRAWN: 'Rút yêu cầu nghỉ của huấn luyện viên',
  COACH_LEAVE_APPROVED: 'Duyệt yêu cầu nghỉ của huấn luyện viên',
  COACH_LEAVE_REJECTED: 'Từ chối yêu cầu nghỉ của huấn luyện viên',
  COACH_LEAVE_CANCELLED: 'Hủy lịch nghỉ của huấn luyện viên',
  CENTER_VISIT_CREATED: 'Check-in trung tâm',
  CENTER_VISIT_CHECKED_OUT: 'Checkout trung tâm',
  SPORT_CLASS_CREATED: 'Tạo lớp học',
  SPORT_CLASS_UPDATED: 'Cập nhật lớp học',
  BOOKING_CREATED: 'Đặt lịch tập',
  BOOKING_CANCELLED: 'Hủy lịch tập',
  MEMBERSHIP_ORDER_CREATED: 'Tạo đơn đăng ký gói tập',
  MEMBERSHIP_ORDER_CANCELLED: 'Hủy đơn đăng ký gói tập',
  MEMBERSHIP_ACTIVATED: 'Kích hoạt gói tập',
  PAYMENT_RECONCILED: 'Đối soát thanh toán',
  PAYMENT_PAID: 'Xác nhận thanh toán thành công',
  PAYMENT_RECORDED: 'Ghi nhận thanh toán',
  RECEIPT_ISSUED: 'Phát hành biên lai',
  MEMBERSHIP_FREEZE_REQUESTED: 'Gửi yêu cầu đóng băng gói tập',
  MEMBERSHIP_FREEZE_APPROVED: 'Duyệt yêu cầu đóng băng gói tập',
  MEMBERSHIP_FREEZE_REJECTED: 'Từ chối yêu cầu đóng băng gói tập',
  MEMBERSHIP_FREEZE_WITHDRAWN: 'Rút yêu cầu đóng băng gói tập',
  MEMBERSHIP_FREEZE_SCHEDULED: 'Lên lịch đóng băng gói tập',
  MEMBERSHIP_FREEZE_STARTED: 'Bắt đầu đóng băng gói tập',
  MEMBERSHIP_FREEZE_COMPLETED: 'Hoàn tất đóng băng gói tập',
  MEMBERSHIP_FREEZE_ENDED_EARLY: 'Kết thúc đóng băng gói tập sớm',
  MEMBERSHIP_REFUND_REQUESTED: 'Gửi yêu cầu hoàn tiền',
  MEMBERSHIP_REFUND_FIRST_APPROVED: 'Duyệt bước đầu yêu cầu hoàn tiền',
  MEMBERSHIP_REFUND_CASH_DISBURSED: 'Ghi nhận chi tiền hoàn',
  MEMBERSHIP_REFUND_COMPLETED: 'Hoàn tất yêu cầu hoàn tiền',
  MEMBERSHIP_REFUND_REJECTED: 'Từ chối yêu cầu hoàn tiền',
  MEMBERSHIP_TERMINATION_REQUESTED: 'Gửi yêu cầu hủy gói tập',
  MEMBERSHIP_TERMINATION_APPROVED: 'Duyệt yêu cầu hủy gói tập',
  MEMBERSHIP_TERMINATION_REJECTED: 'Từ chối yêu cầu hủy gói tập',
  MEMBERSHIP_TERMINATION_WITHDRAWN: 'Rút yêu cầu hủy gói tập',
  MEMBERSHIP_TERMINATION_EXECUTED: 'Thực hiện hủy gói tập',
  MEMBERSHIP_PLAN_CREATED: 'Tạo loại gói tập',
  MEMBERSHIP_PLAN_UPDATED: 'Cập nhật loại gói tập',
  MEMBERSHIP_OFFER_CREATED: 'Tạo gói tập',
  MEMBERSHIP_OFFER_UPDATED: 'Cập nhật gói tập',
  TRAINING_PLAN_CREATED: 'Tạo kế hoạch tập luyện',
  TRAINING_PLAN_UPDATED: 'Cập nhật kế hoạch tập luyện',
  TRAINING_RESULT_CREATED: 'Ghi nhận kết quả tập luyện',
  TRAINING_RESULT_UPDATED: 'Cập nhật kết quả tập luyện',
  TRAINING_FEEDBACK_CREATED: 'Tạo nhận xét tập luyện',
  TRAINING_FEEDBACK_UPDATED: 'Cập nhật nhận xét tập luyện',
};

const TARGET_LABELS = {
  COURSE_PAYMENT: "Thanh toán khóa học",
  COURSE_RESERVATION: "Giữ chỗ khóa học",
  COURSE_SCHEDULE_CHANGE_RESPONSE: "Phản hồi thay đổi lịch khóa học",
  COURSE_WAITLIST: "Hàng chờ khóa học",
  CourseEnrollmentSession: "Điểm danh buổi khóa học",
  COURSE: 'Khóa học', COURSE_RUN: 'Đợt học', COURSE_SESSION: 'Buổi khóa học', COURSE_ORDER: 'Đơn khóa học',
  COURSE_ENROLLMENT: 'Đăng ký khóa học', COURSE_REFUND_OBLIGATION: 'Khoản hoàn khóa học',
  COURSE_WITHDRAWAL_REQUEST: 'Yêu cầu rút khóa học', COURSE_TRANSFER_REQUEST: 'Yêu cầu chuyển đợt học', COURSE_TRANSFER_OFFER: 'Đề nghị chuyển đợt học',
  DISCIPLINE: 'Bộ môn',
  MANUAL_ACTIVATION_REQUEST: 'Yêu cầu kích hoạt tài khoản',
  ATTENDANCE: 'Lượt điểm danh',
  Attendance: 'Lượt điểm danh',
  CLASS_SESSION: 'Buổi tập',
  ROOM: 'Phòng tập',
  ROOM_SUSPENSION: 'Lịch tạm ngưng phòng',
  COACH_LEAVE_REQUEST: 'Yêu cầu nghỉ của huấn luyện viên',
  MEMBERSHIP_FREEZE_REQUEST: 'Yêu cầu đóng băng gói tập',
  REFUND_REQUEST: 'Yêu cầu hoàn tiền',
  MEMBERSHIP_TERMINATION_REQUEST: 'Yêu cầu hủy gói tập',
  SESSION_WAITLIST: 'Hàng chờ buổi tập',
  WAITLIST: 'Hàng chờ buổi tập',
  EMAIL_CHANGE_REQUEST: 'Yêu cầu đổi email',
  COACH_ASSIGNMENT: 'Phân công huấn luyện viên',
  CENTER_VISIT: 'Lượt vào trung tâm',
  SPORT_CLASS: 'Lớp học',
  BOOKING: 'Lịch đặt',
  MEMBERSHIP: 'Gói tập của hội viên',
  MEMBERSHIP_ORDER: 'Đơn đăng ký gói tập',
  PAYMENT: 'Thanh toán',
  RECEIPT: 'Biên lai',
  ACCOUNT: 'Tài khoản',
  MEMBER_PROFILE: 'Hồ sơ hội viên',
  MEMBERSHIP_PLAN: 'Loại gói tập',
  MEMBERSHIP_OFFER: 'Gói tập',
  TRAINING_PLAN: 'Kế hoạch tập luyện',
  TRAINING_RESULT: 'Kết quả tập luyện',
  TRAINING_FEEDBACK: 'Nhận xét tập luyện',
};

const ROLE_LABELS = {
  MEMBER: 'Hội viên',
  COACH: 'Huấn luyện viên',
  RECEPTIONIST: 'Lễ tân',
  MANAGER: 'Quản lý',
};

const FIELD_LABELS = {
  imageUrl: 'Đường dẫn hình ảnh', submittedAt: 'Thời điểm gửi duyệt', reviewedAt: 'Thời điểm xét duyệt',
  reviewReason: 'Lý do xét duyệt', namedCoachCommitment: 'Cam kết huấn luyện viên chỉ định',
  policyVersionSnapshot: 'Phiên bản chính sách áp dụng',
  activeEnrollmentCount: "Số học viên đang học",
  activityAt: "Thời điểm tập luyện",
  approvedAmount: "Số tiền được duyệt",
  archivedPlanVersion: "Phiên bản kế hoạch đã lưu trữ",
  birthDate: "Ngày sinh",
  cancellationSource: "Nguồn hủy",
  cancelledFutureBookings: "Số lịch đặt sắp tới đã hủy",
  cancelledPayments: "Số thanh toán đã hủy",
  cause: "Nguyên nhân",
  changedSessionCount: "Số buổi đã thay đổi",
  classType: "Loại lớp học",
  coachFullName: "Họ tên huấn luyện viên",
  content: "Nội dung",
  createdAt: "Thời điểm tạo",
  creditedDays: "Số ngày được bù",
  currencyCode: "Đơn vị tiền tệ",
  description: "Mô tả",
  displayName: "Tên hiển thị",
  durationDays: "Thời hạn (ngày)",
  emergencyContactName: "Tên người liên hệ khẩn cấp",
  emergencyContactRelationship: "Quan hệ với người liên hệ",
  evidence: "Thông tin xác minh",
  expectedVersion: "Phiên bản dự kiến",
  feeAmount: "Phí",
  fullName: "Họ và tên",
  generation: "Lần phát hành mã xác minh",
  hasEmergencyContact: "Có thông tin liên hệ khẩn cấp",
  memberCode: "Mã hội viên",
  memberFullName: "Họ tên hội viên",
  method: "Phương thức",
  mode: "Chế độ",
  newEmail: "Email mới",
  notes: "Ghi chú",
  oldEmail: "Email cũ",
  passwordReset: "Đã đặt lại mật khẩu",
  paymentRequired: "Cần thanh toán",
  pendingEmail: "Email chờ xác minh",
  planCode: "Mã loại gói tập",
  priceAmount: "Giá tiền",
  requestedAmount: "Số tiền yêu cầu",
  requestedByName: "Người gửi yêu cầu",
  requestedCapacity: "Sức chứa yêu cầu",
  requesterRole: "Vai trò người yêu cầu",
  response: "Phản hồi",
  securityEvent: "Sự kiện bảo mật",
  suggestedAmount: "Số tiền đề xuất",
  targetTuitionVnd: "Học phí đợt học mới (VND)",
  terminalReason: "Lý do kết thúc",
  title: "Tiêu đề",
  unresolvedRefundObligationCount: "Số khoản hoàn tiền chưa xử lý",
  usageMode: "Hình thức sử dụng",
  versionNumber: "Số phiên bản",
  identityVerified: 'Đã xác minh danh tính',
  checkedOut: 'Đã checkout',
  checkedOutAt: 'Thời điểm checkout',
  checkedOutBy: 'Mã tài khoản thực hiện checkout',
  checkoutSource: 'Nguồn checkout',
  amountPaidVnd: 'Số tiền đã thanh toán (VND)',
  orderReference: 'Mã đơn khóa học',
  expiresAt: 'Thời điểm hết hạn',
  code: 'Mã', runCode: 'Mã đợt học', courseCode: 'Mã khóa học', courseName: 'Tên khóa học',
  startAt: 'Bắt đầu', endAt: 'Kết thúc', plannedStartAt: 'Dự kiến khai giảng', plannedEndAt: 'Dự kiến kết thúc',
  registrationOpensAt: 'Mở đăng ký', registrationClosesAt: 'Đóng đăng ký', unitNumber: 'Buổi số',
  minimumEnrollment: 'Số đăng ký tối thiểu', defaultMinimumEnrollment: 'Số đăng ký tối thiểu mặc định',
  tuitionVnd: 'Học phí (VND)', allocationVnd: 'Phân bổ học phí (VND)', amountVnd: 'Số tiền (VND)',
  totalUnits: 'Số buổi', remainingUnits: 'Số buổi còn lại', policyVersion: 'Chính sách',
  refundAmountVnd: 'Tiền hoàn (VND)', refundBasisVnd: 'Cơ sở hoàn tiền (VND)', creditVnd: 'Giá trị chuyển (VND)', cashPaidVnd: 'Tiền trả thêm (VND)',
  status: 'Trạng thái',
  name: 'Tên',
  email: 'Email',
  phone: 'Số điện thoại',
  role: 'Vai trò',
  capacity: 'Sức chứa',
  cancelledBookings: 'Số lịch đặt đã hủy',
  startTime: 'Thời gian bắt đầu',
  endTime: 'Thời gian kết thúc',
  reason: 'Lý do',
  reasonDetail: 'Chi tiết lý do',
  reasonCode: 'Mã lý do',
  source: 'Nguồn',
  verificationMethod: 'Phương thức xác minh',
  evidenceNote: 'Thông tin xác minh',
  decisionNote: 'Ghi chú quyết định',
  roomName: 'Tên phòng',
  roomCode: 'Mã phòng',
  disciplineName: 'Tên bộ môn',
  className: 'Tên lớp học',
  coachName: 'Tên huấn luyện viên',
  memberName: 'Tên hội viên',
  planName: 'Tên gói tập',
  offerName: 'Tên gói đăng ký',
  amount: 'Số tiền',
  price: 'Giá',
  refundAmount: 'Số tiền hoàn',
  paymentMethod: 'Phương thức thanh toán',
  paymentStatus: 'Trạng thái thanh toán',
  startDate: 'Ngày bắt đầu',
  endDate: 'Ngày kết thúc',
  requestedAt: 'Thời điểm gửi yêu cầu',
  approvedAt: 'Thời điểm duyệt',
  cancelledAt: 'Thời điểm hủy',
};

const VALUE_LABELS = {
  ...COURSE_REFUND_SOURCE_LABELS,
  APPROVED_PENDING_PAYMENT: 'Đã duyệt, chờ thanh toán', OBSOLETE: 'Không còn áp dụng',
  EXCLUSIVE: 'Sử dụng riêng', SHARED: 'Sử dụng chung',
  ATTEMPT_LIMIT: "Vượt số lần xác minh cho phép",
  BOOKED: "Đã đặt lịch",
  FAILED: "Thất bại",
  RETURNED: "Đã trả lại",
  WAITING: "Đang chờ",
  NOT_RECORDED: "Chưa điểm danh",
  EMAIL_OTP: "Mã xác minh email",
  OTP_EXPIRED: "Mã xác minh hết hạn",
  REGISTRATION_EXPIRED: "Đăng ký hết hạn",
  SELF_REGISTRATION: "Tự đăng ký",
  SESSION_STARTED: "Buổi tập đã bắt đầu",
  SESSION_CANCELLED: "Buổi tập đã hủy",
  MEMBER_SUSPENDED: "Hội viên bị tạm khóa",
  ENDED: "Đã kết thúc",
  FIRST_APPROVED: "Đã duyệt bước đầu",
  CASH_DISBURSED: "Đã chi tiền hoàn",
  PENDING_APPROVAL: "Chờ phê duyệt",
  RESOLVED_BY_REFUND: "Đã xử lý bằng hoàn tiền",
  REMOVED_BY_RUN_CHANGE: "Đã bỏ do thay đổi đợt học",
  VOLUNTARY: "Tự nguyện",
  START_DELAY_OVER_7_DAYS: "Khai giảng trễ hơn 7 ngày",
  MEMBER_SCHEDULE_CONFLICT: "Trùng lịch của hội viên",
  REDUCED_UNIT_COUNT: "Giảm số buổi học",
  CENTER_SESSION_RESCHEDULE: "Trung tâm đổi lịch buổi học",
  VND: "Việt Nam đồng",
  GROUP: "Lớp nhóm",
  PT: "Huấn luyện cá nhân",
  SEPAY: "Chuyển khoản qua SePay",
  MEMBERSHIP: 'Gói tập', COURSE: 'Khóa học',
  AUTO_REENTRY: 'Tự động khi check-in lại', MIGRATION: 'Chuyển đổi dữ liệu',
  MEMBERSHIP_TERMINATION: 'Chấm dứt gói tập', MEMBERSHIP_FREEZE: 'Đóng băng gói tập',
  PRESENT: 'Có mặt', ABSENT: 'Vắng mặt',
  DRAFT: 'Bản nháp', PUBLISHED: 'Đã công bố', ARCHIVED: 'Đã lưu trữ',
  OPEN_FOR_REGISTRATION: 'Đang mở đăng ký', CONFIRMED: 'Đã xác nhận mở lớp', SETTLEMENT_PENDING: 'Chờ quyết toán',
  CANCELLED_PENDING_MAKEUP: 'Đã hủy, chờ học bù', MAKEUP_SCHEDULED: 'Đã xếp buổi bù', UNRESOLVED: 'Chưa xử lý',
  PENDING_REVIEW: 'Chờ duyệt', DISBURSEMENT_RECORDED: 'Đã ghi nhận chi', PENDING_VERIFICATION: 'Chờ xác minh',
  OFFERED: 'Chờ chấp nhận đề nghị', PENDING_PAYMENT: 'Chờ thanh toán', TRANSFERRED: 'Đã chuyển đợt học',
  MEMBER_WITHDRAWAL: 'Rút khóa học', COURSE_RUN_CANCELLED: 'Hủy đợt học', TRANSFER_CREDIT_EXCESS: 'Chênh lệch chuyển đợt',
  EMAIL_DELIVERY_FAILED: 'Gửi email thất bại',
  MEMBER_CANNOT_ACCESS_EMAIL: 'Hội viên không truy cập được email',
  ACCESSIBILITY_SUPPORT: 'Cần hỗ trợ tiếp cận',
  IN_PERSON_GOVERNMENT_ID_CHECK: 'Xác minh trực tiếp bằng giấy tờ tùy thân',
  IN_PERSON_PROFILE_AND_REGISTERED_PHONE_MATCH: 'Đối chiếu hồ sơ và số điện thoại đã đăng ký',
  OTHER_APPROVED_PROCEDURE: 'Quy trình xác minh khác đã được duyệt',
  SCHEDULED_CLEANUP: 'Tác vụ tự động dọn đăng ký hết hạn',
  MANUAL: 'Thủ công',
  SYSTEM: 'Hệ thống',
  RECEPTIONIST: 'Lễ tân',
  MANAGER: 'Quản lý',
  MEMBER: 'Hội viên',
  COACH: 'Huấn luyện viên',
  CASH: 'Tiền mặt',
  CARD: 'Thẻ',
  BANK_TRANSFER: 'Chuyển khoản',
  CASH_PAYMENT: 'Tiền mặt',
  BANK_CARD: 'Thẻ ngân hàng',
  TRANSFER: 'Chuyển khoản',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Đã từ chối',
  EXPIRED: 'Đã hết hạn',
  WITHDRAWN: 'Đã rút yêu cầu',
  REQUESTED: 'Đã gửi yêu cầu',
  STANDARD: 'Tiêu chuẩn',
  PLUS: 'Plus',
  PREMIUM: 'Premium',
  BASIC: 'Cơ bản',
  OTHER: 'Khác',
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Ngừng hoạt động',
  SUSPENDED: 'Tạm ngưng',
  SCHEDULED: 'Đã lên lịch',
  IN_PROGRESS: 'Đang diễn ra',
  COMPLETED: 'Đã hoàn thành',
  CANCELLED: 'Đã hủy',
  PAID: 'Đã thanh toán',
  PENDING: 'Đang chờ xử lý',
};

const filterSchema = z.object({
  action: z.string().max(120),
  targetType: z.string().max(80),
  from: z.string(),
  to: z.string(),
}).superRefine((value, ctx) => {
  if (value.from && value.to && value.from > value.to) {
    ctx.addIssue({ code: 'custom', path: ['to'], message: 'Ngày kết thúc phải từ ngày bắt đầu trở đi.' });
  }
});

const EMPTY_FILTERS = { action: '', targetType: '', from: '', to: '' };

function actionLabel(value) {
  if (!value) return 'Hoạt động khác';
  return ACTION_LABELS[value] || 'Hoạt động khác';
}

function targetLabel(value) {
  if (!value) return 'Đối tượng khác';
  return TARGET_LABELS[value] || 'Đối tượng khác';
}

function actorIdentity(event) {
  if (!event.actorAccountId) return { name: 'Hệ thống', role: '' };
  return {
    name: event.actorName?.trim() || 'Nhân viên hệ thống',
    role: ROLE_LABELS[event.actorRole] || (event.actorRole ? 'Nhân viên' : ''),
  };
}

function reasonLabel(event) {
  if (event.action?.startsWith('COURSE_')) {
    const translated = courseReasonLabel(event.reason);
    if (translated !== event.reason) return translated;
  }
  const systemReasons = {
    COACH_LEAVE_WITHDRAWN: { 'Coach withdrew leave request': 'Huấn luyện viên rút yêu cầu nghỉ' },
    COACH_LEAVE_CANCELLED: { 'Coach cancelled approved leave': 'Huấn luyện viên hủy lịch nghỉ đã duyệt' },
    SESSION_ASSIGNMENT_CHANGED: { 'Manager changed session assignment': 'Quản lý thay đổi phân công buổi tập' },
    BOOKING_CANCELLED: { 'Member suspended': 'Hội viên bị tạm khóa', 'MEMBER cancellation': 'Hội viên hủy lịch đặt', 'RECEPTIONIST cancellation': 'Lễ tân hủy lịch đặt' },
    COURSE_WITHDRAWAL_CANCELLED: { COURSE_RUN_CANCELLED: 'Đợt học đã bị hủy' },
    PAYMENT_PAID: { 'Cash received by receptionist': 'Lễ tân đã nhận tiền mặt' },
  };
  if (systemReasons[event.action]?.[event.reason]) return systemReasons[event.action][event.reason];
  if ((event.action === 'ATTENDANCE_CHANGED' && event.reason === 'Coach changed attendance')
    || (event.action === 'COURSE_ATTENDANCE_CHANGED' && event.reason === 'Coach changed Course attendance')) {
    return 'Huấn luyện viên cập nhật điểm danh';
  }
  if (event.action === 'CENTER_VISIT_CHECKED_OUT') {
    const checkoutReasons = {
      'MEMBER checkout': 'Hội viên tự checkout',
      'RECEPTIONIST checkout': 'Lễ tân thực hiện checkout',
      'AUTO_REENTRY checkout': 'Tự động checkout lượt cũ khi check-in lại',
      'MIGRATION checkout': 'Checkout khi chuyển đổi dữ liệu',
      'MEMBERSHIP_TERMINATION checkout': 'Checkout do chấm dứt gói tập',
      'MEMBERSHIP_FREEZE checkout': 'Checkout do đóng băng gói tập',
    };
    return checkoutReasons[event.reason] || event.reason;
  }
  return event.reason;
}

function displayValue(value, key) {
  if (value == null || value === '') return 'Không có';
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  const codedFields = ['status', 'paymentStatus', 'role', 'requesterRole', 'source', 'checkoutSource', 'cancellationSource', 'reasonCode', 'terminalReason', 'reason', 'verificationMethod', 'classType', 'usageMode', 'mode', 'method', 'paymentMethod', 'currencyCode', 'planCode', 'cause', 'response', 'securityEvent'];
  if (codedFields.includes(key) && Object.hasOwn(VALUE_LABELS, value)) return VALUE_LABELS[value];
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return `${formatGymDate(value)} · ${formatGymTime(value)}`;
  }
  return String(value);
}

function visibleDetails(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  return Object.entries(data)
    .filter(([, value]) => value == null || typeof value !== 'object')
    .filter(([key]) => !key.toLocaleLowerCase('en-US').endsWith('id'))
    .map(([key, value]) => ({ key, label: FIELD_LABELS[key] || `Thông tin (${key})`, value: displayValue(value, key) }));
}

function DetailList({ title, data }) {
  const details = visibleDetails(data);
  if (details.length === 0) return null;
  return (
    <div className="mt-2">
      <strong className="small">{title}</strong>
      <ul className="small mb-0 ps-3">
        {details.map((item) => <li key={item.key}>{item.label}: {item.value}</li>)}
      </ul>
    </div>
  );
}

export default function AuditHistoryPage() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { register, control, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(filterSchema),
    defaultValues: EMPTY_FILTERS,
  });

  usePollingEffect(({ background, track, commitValue, commitError, failed }) => {
    let active = true;
    if (!background) commitValue(setLoading, true);
    commitError(setError, null);
    track(listAuditEvents({ ...filters, page, size: 20 })
      .then((data) => { if (active) commitValue(setResult, data); })
      .catch((err) => { failed(err);  if (active) commitError(setError, err); })
      .finally(() => { if (active) if (!background) commitValue(setLoading, false); }));
    return () => { active = false; };
  }, [filters, page]);

  function apply(values) {
    setPage(0);
    setFilters(values);
  }

  function clear() {
    reset(EMPTY_FILTERS);
    setPage(0);
    setFilters(EMPTY_FILTERS);
  }

  const rows = result?.content || [];

  return (
    <div>
      <div className="mb-4">
        <h1 className="h3 fw-bold mb-1">Lịch sử hoạt động</h1>
        <p className="text-muted mb-0">Theo dõi các thao tác quan trọng trong hệ thống.</p>
      </div>

      <Card className="border-0 shadow-sm mb-4">
        <Card.Body>
          <Form onSubmit={handleSubmit(apply)}>
            <Row className="g-3">
              <Col md={3}>
                <Form.Label>Hoạt động</Form.Label>
                <Form.Select {...register('action')}>
                  <option value="">Tất cả hoạt động</option>
                  {Object.entries(ACTION_LABELS)
                    .sort(([, a], [, b]) => a.localeCompare(b, 'vi'))
                    .map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Form.Select>
              </Col>
              <Col md={3}>
                <Form.Label>Đối tượng</Form.Label>
                <Form.Select {...register('targetType')}>
                  <option value="">Tất cả đối tượng</option>
                  {Object.entries(TARGET_LABELS)
                    .sort(([, a], [, b]) => a.localeCompare(b, 'vi'))
                    .map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Form.Select>
              </Col>
              <Col md={2}>
                <Form.Label>Từ ngày</Form.Label>
                <RhfDateInput control={control} name="from" />
              </Col>
              <Col md={2}>
                <Form.Label>Đến ngày</Form.Label>
                <RhfDateInput control={control} name="to" isInvalid={Boolean(errors.to)} />
                <Form.Control.Feedback type="invalid">{errors.to?.message}</Form.Control.Feedback>
              </Col>
              <Col md={2} className="d-flex align-items-end gap-2">
                <Button type="submit" variant="danger">Lọc</Button>
                <Button type="button" variant="outline-secondary" onClick={clear}>Xóa lọc</Button>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>

      <ErrorAlert error={error} title="Không tải được lịch sử hoạt động" onClose={() => setError(null)} />

      {loading ? (
        <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div>
      ) : rows.length === 0 ? (
        <Alert variant="light" className="border">Không có hoạt động phù hợp.</Alert>
      ) : (
        <div className="table-responsive">
          <Table hover className="align-middle bg-white shadow-sm">
            <thead><tr><th>Thời điểm</th><th>Hoạt động</th><th>Đối tượng</th><th>Người thực hiện</th><th>Chi tiết</th></tr></thead>
            <tbody>
              {rows.map((event) => {
                const hasDetails = Boolean(event.reason) || visibleDetails(event.beforeData).length > 0 || visibleDetails(event.afterData).length > 0;
                const actor = actorIdentity(event);
                return (
                  <tr key={event.id}>
                    <td>{formatGymDate(event.createdAt)} · {formatGymTime(event.createdAt)}</td>
                    <td>{actionLabel(event.action)}</td>
                    <td>{targetLabel(event.targetType)}</td>
                    <td>
                      <div className="fw-semibold">{actor.name}</div>
                      {actor.role ? <div className="small text-muted">{actor.role}</div> : null}
                    </td>
                    <td>
                      {hasDetails ? (
                        <details>
                          <summary>Xem chi tiết</summary>
                          {event.reason ? <p className="small mt-2 mb-1"><strong>Lý do:</strong> {reasonLabel(event)}</p> : null}
                          <DetailList title="Trước thay đổi" data={event.beforeData} />
                          <DetailList title="Sau thay đổi" data={event.afterData} />
                        </details>
                      ) : <span className="text-muted">Không có chi tiết</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}

      {result && result.totalPages > 1 ? (
        <div className="d-flex justify-content-between align-items-center mt-3">
          <Button size="sm" variant="outline-secondary" disabled={page === 0 || loading} onClick={() => setPage((value) => value - 1)}>Trang trước</Button>
          <span className="text-muted small">Trang {page + 1}/{result.totalPages} · {result.totalElements} hoạt động</span>
          <Button size="sm" variant="outline-secondary" disabled={page + 1 >= result.totalPages || loading} onClick={() => setPage((value) => value + 1)}>Trang sau</Button>
        </div>
      ) : null}
    </div>
  );
}
