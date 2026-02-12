import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Elegant email template builder
function emailLayout(content: string, footerNote?: string): string {
  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Antyk.org.pl</title>
</head>
<body style="margin:0;padding:0;background-color:#f8f6f3;font-family:'Georgia','Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f6f3;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);padding:32px 40px;text-align:center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <div style="font-size:28px;font-weight:700;color:#e8d5b7;letter-spacing:2px;font-family:'Georgia',serif;">
                      ✦ ANTYK ✦
                    </div>
                    <div style="font-size:12px;color:#a89070;letter-spacing:4px;margin-top:6px;text-transform:uppercase;">
                      Księgarnia Patriotyczna
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Decorative line -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:3px;background:linear-gradient(90deg,transparent,#c9a96e,transparent);margin:0;"></div>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:32px 40px 24px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background:linear-gradient(90deg,transparent,#e0d5c5,transparent);"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px 32px;text-align:center;">
              ${footerNote ? `<p style="font-size:13px;color:#8a7a6a;margin:0 0 16px;font-style:italic;">${footerNote}</p>` : ""}
              <p style="font-size:12px;color:#b0a090;margin:0;">
                Ta wiadomość została wysłana automatycznie z systemu<br/>
                <span style="color:#c9a96e;">sklep.antyk.org.pl</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 16px;font-size:13px;color:#8a7a6a;font-weight:600;vertical-align:top;white-space:nowrap;border-bottom:1px solid #f0ebe4;">${label}</td>
    <td style="padding:8px 16px;font-size:14px;color:#2c2c2c;border-bottom:1px solid #f0ebe4;">${value}</td>
  </tr>`;
}

function statusBadge(statusLabel: string, status: string): string {
  const colors: Record<string, { bg: string; fg: string; border: string }> = {
    nowy: { bg: "#eef2ff", fg: "#4338ca", border: "#c7d2fe" },
    w_trakcie: { bg: "#fef3c7", fg: "#92400e", border: "#fde68a" },
    potrzebne_informacje: { bg: "#fce7f3", fg: "#9d174d", border: "#fbcfe8" },
    rozwiazany: { bg: "#d1fae5", fg: "#065f46", border: "#a7f3d0" },
    anulowane: { bg: "#f3f4f6", fg: "#6b7280", border: "#e5e7eb" },
  };
  const c = colors[status] || colors.nowy;
  return `<span style="display:inline-block;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:600;background:${c.bg};color:${c.fg};border:1px solid ${c.border};">${statusLabel}</span>`;
}

const STATUS_LABELS: Record<string, string> = {
  nowy: "Nowy",
  w_trakcie: "W trakcie",
  potrzebne_informacje: "Potrzebne informacje",
  rozwiazany: "Rozwiązany",
  anulowane: "Anulowane",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { type, reportId, newStatus, commentId } = await req.json();

    const { data: report, error: reportErr } = await supabase
      .from("bug_reports")
      .select("*")
      .eq("id", reportId)
      .single();

    if (reportErr || !report) {
      return new Response(JSON.stringify({ error: "Report not found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sendEmail = async (to: string[], subject: string, html: string) => {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Antyk Księgarnia <onboarding@resend.dev>",
          to,
          subject,
          html,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("Resend error:", errText);
      }
      return res;
    };

    if (type === "new_report") {
      // Notify admins about new bug report
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (adminRoles && adminRoles.length > 0) {
        const adminIds = adminRoles.map((r: any) => r.user_id);
        const { data: { users: adminUsers } } = await supabase.auth.admin.listUsers();
        const adminEmails = adminUsers
          .filter((u: any) => adminIds.includes(u.id) && u.email)
          .map((u: any) => u.email);

        if (adminEmails.length > 0) {
          const content = `
            <h2 style="font-size:22px;color:#1a1a2e;margin:0 0 8px;font-weight:700;">Nowe zgłoszenie błędu</h2>
            <p style="font-size:14px;color:#8a7a6a;margin:0 0 24px;">Otrzymano nowe zgłoszenie od użytkownika systemu.</p>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;border-radius:12px;border:1px solid #ede8e0;margin-bottom:24px;">
              ${infoRow("Temat", `<strong>${report.title}</strong>`)}
              ${infoRow("Zgłosił/a", report.user_email)}
              ${infoRow("Status", statusBadge("Nowy", "nowy"))}
              ${report.page_url ? infoRow("Strona", `<a href="${report.page_url}" style="color:#0f3460;text-decoration:none;">${report.page_url}</a>`) : ""}
              ${report.screen_size ? infoRow("Rozdzielczość", report.screen_size) : ""}
            </table>

            <div style="background:#faf8f5;border-radius:12px;border:1px solid #ede8e0;padding:20px;margin-bottom:24px;">
              <p style="font-size:12px;color:#8a7a6a;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Opis problemu</p>
              <p style="font-size:14px;color:#2c2c2c;margin:0;line-height:1.7;white-space:pre-wrap;">${report.description}</p>
            </div>

            ${report.screenshot_url ? `
            <div style="text-align:center;margin-bottom:8px;">
              <a href="${report.screenshot_url}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#1a1a2e,#0f3460);color:#e8d5b7;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;letter-spacing:0.5px;">
                📸 Zobacz zrzut ekranu
              </a>
            </div>` : ""}
          `;

          await sendEmail(
            adminEmails,
            `✦ Nowe zgłoszenie: ${report.title}`,
            emailLayout(content, "Zaloguj się do panelu administracyjnego, aby zarządzać zgłoszeniem."),
          );
        }
      }

      // Send confirmation to the user
      const userContent = `
        <h2 style="font-size:22px;color:#1a1a2e;margin:0 0 8px;font-weight:700;">Dziękujemy za zgłoszenie!</h2>
        <p style="font-size:15px;color:#4a4a4a;margin:0 0 24px;line-height:1.6;">
          Otrzymaliśmy Twoje zgłoszenie i zajmiemy się nim tak szybko, jak to możliwe. Poniżej znajdziesz podsumowanie.
        </p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;border-radius:12px;border:1px solid #ede8e0;margin-bottom:24px;">
          ${infoRow("Temat", `<strong>${report.title}</strong>`)}
          ${infoRow("Status", statusBadge("Nowy", "nowy"))}
          ${infoRow("Data zgłoszenia", new Date(report.created_at).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }))}
        </table>

        <div style="background:linear-gradient(135deg,#faf8f5,#f5f0e8);border-radius:12px;border:1px solid #ede8e0;padding:20px;margin-bottom:8px;text-align:center;">
          <p style="font-size:14px;color:#6a5a4a;margin:0;line-height:1.6;">
            Będziemy Cię informować o postępach.<br/>
            Każda zmiana statusu zostanie przesłana na ten adres e-mail.
          </p>
        </div>
      `;

      await sendEmail(
        [report.user_email],
        `✦ Potwierdzenie zgłoszenia: ${report.title}`,
        emailLayout(userContent, "Dziękujemy za pomoc w ulepszaniu naszego systemu!"),
      );

    } else if (type === "status_change") {
      const label = STATUS_LABELS[newStatus] || newStatus;
      
      let statusMessage = "";
      switch (newStatus) {
        case "w_trakcie":
          statusMessage = "Nasz zespół rozpoczął pracę nad Twoim zgłoszeniem. Pracujemy nad rozwiązaniem.";
          break;
        case "potrzebne_informacje":
          statusMessage = "Potrzebujemy dodatkowych informacji, aby kontynuować. Sprawdź komentarze do zgłoszenia.";
          break;
        case "rozwiazany":
          statusMessage = "Twoje zgłoszenie zostało rozwiązane! Dziękujemy za cierpliwość.";
          break;
        case "anulowane":
          statusMessage = "Zgłoszenie zostało anulowane. Jeśli problem nadal występuje, prosimy o ponowne zgłoszenie.";
          break;
        default:
          statusMessage = "Status Twojego zgłoszenia został zaktualizowany.";
      }

      const content = `
        <h2 style="font-size:22px;color:#1a1a2e;margin:0 0 8px;font-weight:700;">Aktualizacja zgłoszenia</h2>
        <p style="font-size:15px;color:#4a4a4a;margin:0 0 24px;line-height:1.6;">
          ${statusMessage}
        </p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;border-radius:12px;border:1px solid #ede8e0;margin-bottom:24px;">
          ${infoRow("Temat", `<strong>${report.title}</strong>`)}
          ${infoRow("Nowy status", statusBadge(label, newStatus))}
        </table>

        ${newStatus === "rozwiazany" ? `
        <div style="background:linear-gradient(135deg,#d1fae5,#ecfdf5);border-radius:12px;border:1px solid #a7f3d0;padding:20px;text-align:center;margin-bottom:8px;">
          <p style="font-size:24px;margin:0 0 8px;">🎉</p>
          <p style="font-size:14px;color:#065f46;margin:0;font-weight:600;">Problem rozwiązany!</p>
          <p style="font-size:13px;color:#047857;margin:4px 0 0;">Dziękujemy za zgłoszenie — dzięki Tobie nasz system jest lepszy.</p>
        </div>` : ""}
      `;

      await sendEmail(
        [report.user_email],
        `✦ ${label}: ${report.title}`,
        emailLayout(content),
      );

    } else if (type === "new_comment") {
      let commentText = "";
      let commenterEmail = "";
      if (commentId) {
        const { data: comment } = await supabase
          .from("bug_report_comments")
          .select("*")
          .eq("id", commentId)
          .single();
        commentText = comment?.comment_text || "";
        commenterEmail = comment?.user_email || "";
      }

      const content = `
        <h2 style="font-size:22px;color:#1a1a2e;margin:0 0 8px;font-weight:700;">Nowy komentarz</h2>
        <p style="font-size:14px;color:#8a7a6a;margin:0 0 24px;">Do Twojego zgłoszenia dodano nową odpowiedź.</p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;border-radius:12px;border:1px solid #ede8e0;margin-bottom:24px;">
          ${infoRow("Zgłoszenie", `<strong>${report.title}</strong>`)}
          ${commenterEmail ? infoRow("Autor", commenterEmail) : ""}
        </table>

        <div style="background:#faf8f5;border-radius:12px;border:1px solid #ede8e0;padding:20px;margin-bottom:24px;">
          <div style="border-left:3px solid #c9a96e;padding-left:16px;">
            <p style="font-size:14px;color:#2c2c2c;margin:0;line-height:1.7;white-space:pre-wrap;">${commentText}</p>
          </div>
        </div>

        <div style="text-align:center;margin-bottom:8px;">
          <p style="font-size:13px;color:#8a7a6a;font-style:italic;">Jeśli chcesz odpowiedzieć, zaloguj się do systemu.</p>
        </div>
      `;

      await sendEmail(
        [report.user_email],
        `✦ Komentarz: ${report.title}`,
        emailLayout(content),
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error in send-bug-report-email:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
