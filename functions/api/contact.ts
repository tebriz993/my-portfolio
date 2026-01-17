export const onRequestPost: PagesFunction<{ SENDGRID_API_KEY: string }> = async (context) => {
    try {
        const { request, env } = context;
        const body: any = await request.json();
        const { name, email, subject, message } = body;

        // Validate required fields
        if (!name || !email || !subject || !message) {
            return new Response(JSON.stringify({
                error: "Missing required fields",
                message: "Name, email, subject, and message are required"
            }), { status: 400, headers: { "Content-Type": "application/json" } });
        }

        if (!env.SENDGRID_API_KEY) {
            return new Response(JSON.stringify({
                error: "Email service not configured",
                message: "SendGrid API key is missing"
            }), { status: 500, headers: { "Content-Type": "application/json" } });
        }

        // Call SendGrid API directly
        const sendGridResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${env.SENDGRID_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                personalizations: [{
                    to: [{ email: 'latifovtebriz@gmail.com' }],
                }],
                from: { email: 'latifovtebriz@gmail.com' }, // Must be verified sender
                subject: `Portfolio Contact: ${subject}`,
                content: [
                    {
                        type: "text/plain",
                        value: `
New Contact Form Submission

Name: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}

Sent from your portfolio website contact form
            `
                    },
                    {
                        type: "text/html",
                        value: `
<h2>New Contact Form Submission</h2>
<p><strong>Name:</strong> ${name}</p>
<p><strong>Email:</strong> ${email}</p>
<p><strong>Subject:</strong> ${subject}</p>
<h3>Message:</h3>
<p>${message.replace(/\n/g, '<br>')}</p>
<hr>
<p><small>Sent from your portfolio website contact form</small></p>
            `
                    }
                ]
            })
        });

        if (!sendGridResponse.ok) {
            const errorText = await sendGridResponse.text();
            throw new Error(`SendGrid API error: ${sendGridResponse.status} ${errorText}`);
        }

        return new Response(JSON.stringify({
            success: true,
            message: "Email sent successfully"
        }), { headers: { "Content-Type": "application/json" } });

    } catch (error) {
        return new Response(JSON.stringify({
            error: "Failed to send email",
            message: String(error)
        }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
};
