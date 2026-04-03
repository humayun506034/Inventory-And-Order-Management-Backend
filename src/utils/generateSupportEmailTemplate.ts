export interface SupportRequestPayload {
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  subject?: string;
  message?: string;
  date?: string;
  time?: string;
  streetAndHouseNumber?: string;
  city?: string;
  zipCode?: string;
  country?: string;
}

export function generateSupportEmailTemplate(
  payload: SupportRequestPayload,
  serviceName: string,
  fileLink?: string,
) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Support Request</title>
</head>
<body style="margin:0;padding:24px;font-family:Arial,sans-serif;background:#f3f4f6;color:#111827;">
  <div style="max-width:700px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="padding:24px;background:#111827;color:#ffffff;font-size:22px;font-weight:700;">
      New Support Request
    </div>
    <div style="padding:24px;">
      <p><strong>Subject:</strong> ${payload.subject ?? 'Support Inquiry'}</p>
      <p><strong>Service:</strong> ${serviceName}</p>
      <p><strong>Name:</strong> ${payload.firstName ?? ''} ${payload.lastName ?? ''}</p>
      <p><strong>Company:</strong> ${payload.companyName ?? ''}</p>
      <p><strong>Email:</strong> ${payload.email ?? ''}</p>
      <p><strong>Schedule:</strong> ${payload.date ?? ''} ${payload.time ?? ''}</p>
      <p><strong>Address:</strong> ${payload.streetAndHouseNumber ?? ''} ${payload.city ?? ''} ${payload.zipCode ?? ''} ${payload.country ?? ''}</p>
      ${fileLink ? `<p><strong>Attachment:</strong> <a href="${fileLink}" target="_blank">View uploaded file</a></p>` : ''}
      <div style="margin-top:20px;padding:16px;background:#f9fafb;border-radius:12px;">
        ${payload.message ?? ''}
      </div>
    </div>
  </div>
</body>
</html>
`;
}
