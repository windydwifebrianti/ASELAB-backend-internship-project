export const sendEmail = async (
  to: string,
  subject: string,
  htmlBody: string,
) => {
  const apiUrl = process.env.MAIL_API_URL;
  const apiKey = process.env.MAIL_API_KEY;

  if (!apiUrl || !apiKey) {
    throw new Error("Konfigurasi MAIL_API_URL atau MAIL_API_KEY belum diset.");
  }

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apiKey: apiKey,
        to,
        subject,
        body: htmlBody,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Gagal mengirim email via API cPanel");
    }

    return data;
  } catch (error) {
    console.error("Error di sendEmail helper:", error);
    throw error;
  }
};
