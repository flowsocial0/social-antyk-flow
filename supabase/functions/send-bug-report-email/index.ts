import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    // Fetch the bug report
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

    const STATUS_LABELS: Record<string, string> = {
      nowy: "Nowy",
      w_trakcie: "W trakcie",
      potrzebne_informacje: "Potrzebne informacje",
      rozwiazany: "Rozwiązany",
      anulowane: "Anulowane",
    };

    const sendEmail = async (to: string[], subject: string, html: string) => {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Bug Reporter <onboarding@resend.dev>",
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
      // Get all admin emails
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
          await sendEmail(
            adminEmails,
            `[Bug] Nowe zgłoszenie: ${report.title}`,
            `<h2>Nowe zgłoszenie błędu</h2>
            <p><strong>Temat:</strong> ${report.title}</p>
            <p><strong>Opis:</strong> ${report.description}</p>
            <p><strong>Zgłosił:</strong> ${report.user_email}</p>
            <p><strong>URL:</strong> ${report.page_url || "brak"}</p>
            <p><strong>Rozdzielczość:</strong> ${report.screen_size || "brak"}</p>
            ${report.screenshot_url ? `<p><a href="${report.screenshot_url}">Zobacz zrzut ekranu</a></p>` : ""}`,
          );
        }
      }
    } else if (type === "status_change") {
      await sendEmail(
        [report.user_email],
        `[Bug] Zmiana statusu: ${report.title}`,
        `<h2>Status zgłoszenia został zmieniony</h2>
        <p><strong>Temat:</strong> ${report.title}</p>
        <p><strong>Nowy status:</strong> ${STATUS_LABELS[newStatus] || newStatus}</p>`,
      );
    } else if (type === "new_comment") {
      let commentText = "";
      if (commentId) {
        const { data: comment } = await supabase
          .from("bug_report_comments")
          .select("*")
          .eq("id", commentId)
          .single();
        commentText = comment?.comment_text || "";
      }

      await sendEmail(
        [report.user_email],
        `[Bug] Nowy komentarz: ${report.title}`,
        `<h2>Nowy komentarz do zgłoszenia</h2>
        <p><strong>Temat:</strong> ${report.title}</p>
        <p><strong>Komentarz:</strong> ${commentText}</p>`,
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error in send-bug-report-email:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
