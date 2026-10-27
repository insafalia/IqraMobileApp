export type StaffStackParamList = {
  StaffHome: undefined;
  Payment: undefined;
  Job: undefined;
  Material: undefined;
  Attendance: undefined;
};

export type OwnerTabParamList = {
  Dashboard: undefined;
  Customers: undefined;
  Quotations: undefined;
  Wages: undefined;
  Staff: undefined;
};

export type OwnerStackParamList = {
  OwnerTabs: undefined;
  QuotationDetail: { quotationId: string };
};
