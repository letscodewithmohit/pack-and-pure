import axiosInstance from "@core/api/axios";

export const pickupApi = {
  sendLoginOtp: (data) => axiosInstance.post("/pickup-partner/send-login-otp", data),
  verifyOtp: (data) => axiosInstance.post("/pickup-partner/verify-otp", data),
  getMyProfile: () => axiosInstance.get("/pickup-partner/my/profile"),
  updateProfile: (data) => axiosInstance.put("/pickup-partner/my/profile", data),
  getAssignments: (params) =>
    axiosInstance.get("/pickup-partner/my/assignments", { params }),
  markPicked: (id, data) =>
    axiosInstance.post(`/pickup-partner/my/assignments/${id}/mark-picked`, data),
  markHubDelivered: (id, data) =>
    axiosInstance.post(`/pickup-partner/my/assignments/${id}/mark-hub-delivered`, data),
};

