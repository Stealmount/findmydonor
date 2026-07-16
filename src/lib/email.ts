import { authenticatedApi } from './api';

/**
 * Email delivery via the authenticated server-side /api/send-email route.
 */
export async function sendRealEmail(to: string, subject: string, text: string): Promise<boolean> {
  try {
    await authenticatedApi<{ success: boolean }>('/api/send-email', { to, subject, text });
    return true;
  } catch (error) {
    console.error('[Email Service] Exception:', error);
    return false;
  }
}

/** Build rich HTML email for donor SOS alert */
export function buildDonorSosEmailHTML(params: {
  donorName: string;
  bloodType: string;
  units: number;
  component: string;
  hospitalName: string;
  hospitalArea: string;
  hospitalCity: string;
  urgencyLevel: string;
  trackingCode: string;
  patientName: string;
}): { subject: string; html: string; text: string } {
  const urgencyColor = params.urgencyLevel === 'critical' ? '#dc2626' : params.urgencyLevel === 'urgent' ? '#d97706' : '#16a34a';
  const urgencyLabel = params.urgencyLevel.toUpperCase();

  const subject = `🩸 [${urgencyLabel}] Blood Request — ${params.bloodType} needed at ${params.hospitalName}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f8f8f8;">
  <div style="max-width:600px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#dc2626,#991b1b);padding:28px 32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;letter-spacing:-0.5px;">🩸 RaktDaan</h1>
      <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px;">Real-Time Blood Donation Network</p>
    </div>

    <!-- Urgency badge -->
    <div style="background:${urgencyColor};color:#fff;text-align:center;padding:10px;font-size:13px;font-weight:700;letter-spacing:1px;">
      ${urgencyLabel} REQUEST — IMMEDIATE RESPONSE NEEDED
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="font-size:16px;color:#111;margin:0 0 20px;">Hi <strong>${params.donorName.split(' ')[0]}</strong>,</p>
      <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 24px;">
        A patient urgently needs blood that matches your type. You are within range and eligible to donate. Please respond as soon as possible.
      </p>

      <!-- Request details card -->
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:20px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:6px 0;color:#888;font-size:13px;width:140px;">Blood Group</td><td style="padding:6px 0;font-weight:700;font-size:18px;color:#dc2626;">${params.bloodType}</td></tr>
          <tr><td style="padding:6px 0;color:#888;font-size:13px;">Units Needed</td><td style="padding:6px 0;font-weight:600;color:#111;">${params.units}</td></tr>
          <tr><td style="padding:6px 0;color:#888;font-size:13px;">Component</td><td style="padding:6px 0;font-weight:600;color:#111;">${params.component}</td></tr>
          <tr><td style="padding:6px 0;color:#888;font-size:13px;">Hospital</td><td style="padding:6px 0;font-weight:600;color:#111;">${params.hospitalName}</td></tr>
          <tr><td style="padding:6px 0;color:#888;font-size:13px;">Location</td><td style="padding:6px 0;font-weight:600;color:#111;">${params.hospitalArea}, ${params.hospitalCity}</td></tr>
          <tr><td style="padding:6px 0;color:#888;font-size:13px;">Request ID</td><td style="padding:6px 0;font-family:monospace;font-size:13px;color:#555;">${params.trackingCode}</td></tr>
        </table>
      </div>

      <!-- CTA buttons -->
      <div style="text-align:center;margin-bottom:28px;">
        <a href="https://raktdaan.duckdns.org/donor-dashboard" style="display:inline-block;background:linear-gradient(135deg,#dc2626,#991b1b);color:#fff;text-decoration:none;padding:14px 32px;border-radius:50px;font-weight:700;font-size:15px;margin:0 8px 12px;">
          ✅ Accept Request
        </a>
        <a href="https://raktdaan.duckdns.org/tracking?code=${params.trackingCode}" style="display:inline-block;background:#f3f4f6;color:#374151;text-decoration:none;padding:14px 32px;border-radius:50px;font-weight:600;font-size:15px;margin:0 8px 12px;">
          📍 Track Request
        </a>
      </div>

      <p style="font-size:13px;color:#888;text-align:center;margin:0;">
        If you cannot donate, please log into your donor dashboard and decline so we can find another match quickly.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#111;color:rgba(255,255,255,0.5);text-align:center;padding:20px 32px;font-size:12px;">
      <p style="margin:0 0 6px;">RaktDaan — Free Community Blood Donation Network</p>
      <p style="margin:0;">You received this because you are a verified donor. <a href="https://raktdaan.duckdns.org" style="color:rgba(255,255,255,0.7);">Manage preferences</a></p>
    </div>
  </div>
</body>
</html>`;

  const text = `URGENT BLOOD REQUEST — RaktDaan\n\nHi ${params.donorName},\n\nBlood Type: ${params.bloodType}\nUnits: ${params.units}\nHospital: ${params.hospitalName}, ${params.hospitalArea}, ${params.hospitalCity}\nUrgency: ${urgencyLabel}\nRequest ID: ${params.trackingCode}\n\nLog in to accept: https://raktdaan.duckdns.org/donor-dashboard\nTrack: https://raktdaan.duckdns.org/tracking?code=${params.trackingCode}`;

  return { subject, html, text };
}

/** Email to requester when a donor is confirmed */
export function buildRequesterConfirmEmailHTML(params: {
  requesterName: string;
  donorName: string;
  bloodType: string;
  trackingCode: string;
  hospitalName: string;
}): { subject: string; html: string; text: string } {
  const subject = `✅ Donor Confirmed — ${params.bloodType} · Request ${params.trackingCode}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f8f8f8;">
  <div style="max-width:600px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#16a34a,#166534);padding:28px 32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">✅ Donor Confirmed</h1>
    </div>
    <div style="padding:32px;">
      <p style="font-size:16px;color:#111;">Hi <strong>${params.requesterName}</strong>,</p>
      <p style="font-size:15px;color:#444;line-height:1.6;">
        Great news! <strong>${params.donorName}</strong> has confirmed they will donate <strong>${params.bloodType}</strong> blood for request <code>${params.trackingCode}</code> at ${params.hospitalName}.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="https://raktdaan.duckdns.org/tracking?code=${params.trackingCode}" style="display:inline-block;background:linear-gradient(135deg,#16a34a,#166534);color:#fff;text-decoration:none;padding:14px 32px;border-radius:50px;font-weight:700;font-size:15px;">
          📍 Track Live
        </a>
      </div>
    </div>
    <div style="background:#111;color:rgba(255,255,255,0.5);text-align:center;padding:16px;font-size:12px;">
      RaktDaan — Free Community Blood Donation Network
    </div>
  </div>
</body>
</html>`;

  const text = `Donor Confirmed — RaktDaan\n\nHi ${params.requesterName},\n${params.donorName} has confirmed your ${params.bloodType} request (${params.trackingCode}) at ${params.hospitalName}.\n\nTrack: https://raktdaan.duckdns.org/tracking?code=${params.trackingCode}`;
  return { subject, html, text };
}

/** Email OTP Template */
export function buildEmailOtpHTML(otp: string): { subject: string; html: string; text: string } {
  const subject = `🔒 Your RaktDaan Verification Code: ${otp}`;
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f8f8f8;">
  <div style="max-width:600px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#dc2626,#991b1b);padding:28px 32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">Verify Your Account</h1>
    </div>
    <div style="padding:32px;text-align:center;">
      <p style="font-size:16px;color:#111;">Please use the following 6-digit code to complete your registration:</p>
      <div style="margin:28px auto;background:#f3f4f6;border-radius:12px;padding:16px;letter-spacing:6px;font-size:32px;font-weight:800;color:#111;width:fit-content;font-family:monospace;">
        ${otp}
      </div>
      <p style="font-size:14px;color:#444;line-height:1.6;">
        This code is valid for 5 minutes. If you did not request this, you can safely ignore this email.
      </p>
    </div>
    <div style="background:#111;color:rgba(255,255,255,0.5);text-align:center;padding:16px;font-size:12px;">
      RaktDaan — Free Community Blood Donation Network<br/>
      Sent by raktdaan.contact@gmail.com
    </div>
  </div>
</body>
</html>`;

  const text = `Your RaktDaan Verification Code is: ${otp}\n\nThis code is valid for 5 minutes.\n\nSent by raktdaan.contact@gmail.com`;
  return { subject, html, text };
}

/** Registration Welcome Template */
export function buildWelcomeEmailHTML(params: { name: string; type: 'donor' | 'requester'; bloodType?: string; city?: string; pincode?: string }): { subject: string; html: string; text: string } {
  const subject = `Welcome to RaktDaan! 🎉`;
  
  const donorBody = `Thank you for registering as a volunteer donor with Blood Connect! Your profile for blood group <strong>${params.bloodType}</strong> is now active in <strong>${params.city}</strong>. You will receive alerts if patients in pincode <strong>${params.pincode}</strong> or adjacent areas need your blood. Your contact remains completely private until you explicitly consent.`;
  const requesterBody = `Thank you for joining RaktDaan! You can now request emergency blood matching anywhere in Delhi NCR. Verified donors will be instantly notified in real-time.`;
  
  const body = params.type === 'donor' ? donorBody : requesterBody;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f8f8f8;">
  <div style="max-width:600px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#dc2626,#991b1b);padding:28px 32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">Welcome to RaktDaan</h1>
    </div>
    <div style="padding:32px;">
      <p style="font-size:16px;color:#111;">Hi <strong>${params.name.split(' ')[0]}</strong>,</p>
      <p style="font-size:15px;color:#444;line-height:1.6;">
        ${body}
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="https://raktdaan.duckdns.org" style="display:inline-block;background:linear-gradient(135deg,#dc2626,#991b1b);color:#fff;text-decoration:none;padding:14px 32px;border-radius:50px;font-weight:700;font-size:15px;">
          Go to Dashboard
        </a>
      </div>
    </div>
    <div style="background:#111;color:rgba(255,255,255,0.5);text-align:center;padding:16px;font-size:12px;">
      RaktDaan — Free Community Blood Donation Network<br/>
      Sent by raktdaan.contact@gmail.com
    </div>
  </div>
</body>
</html>`;

  const text = `Welcome to RaktDaan, ${params.name}!\n\n${params.type === 'donor' ? donorBody.replace(/<[^>]*>?/gm, '') : requesterBody}\n\nGo to Dashboard: https://raktdaan.duckdns.org\n\nSent by raktdaan.contact@gmail.com`;
  return { subject, html, text };
}
