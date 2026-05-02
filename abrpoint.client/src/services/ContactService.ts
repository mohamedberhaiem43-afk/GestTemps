import apiInstance from '../components/API/apiInstance';

export interface ContactSupportPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface ContactSalesPayload {
  company: string;
  contactName: string;
  email: string;
  phone?: string;
  headcount: string;
  needs?: string;
}

export const sendSupportMessage = async (payload: ContactSupportPayload) => {
  const res = await apiInstance.post('/contact/support', payload);
  return res.data;
};

export const sendSalesRequest = async (payload: ContactSalesPayload) => {
  const res = await apiInstance.post('/contact/sales', payload);
  return res.data;
};
