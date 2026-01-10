// Simpan file ini di folder: /api/proxy.js
// Ini adalah Serverless Function untuk menyembunyikan Token dari Frontend

export default async function handler(req, res) {
  // 1. Setup CORS agar bisa diakses dari Frontend Anda
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); // Ganti '*' dengan domain frontend Anda untuk lebih aman
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, payload } = req.body;
  // Validasi Kode Akses
  const SERVER_ACCESS_CODE = process.env.ACCESS_CODE;

  // Jika Environment Variable belum disetting di Vercel, kita beri peringatan (opsional)
  if (!SERVER_ACCESS_CODE) {
      console.error("SERVER ERROR: ACCESS_CODE environment variable not set.");
      return res.status(500).json({ error: 'Server misconfiguration' });
  }

  // Cek apakah kode yang dikirim user cocok dengan yang di server
  if (accessCode !== SERVER_ACCESS_CODE) {
      return res.status(401).json({ error: 'Akses Ditolak: Kode Akses Salah atau Tidak Ada' });
  }
  // --- MODIFIKASI BERAKHIR ---
  try {
    // --- AKSI GITHUB ---
    if (action === 'github_fetch') {
      const { owner, repo, path } = payload;
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
      
      const response = await fetch(url, {
        headers: { 
          'Authorization': `token ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      if (!response.ok) throw new Error(`GitHub Error: ${response.statusText}`);
      const data = await response.json();
      return res.status(200).json(data);
    }

    if (action === 'github_upload') {
      const { owner, repo, path, content, sha, message } = payload;
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 
          'Authorization': `token ${process.env.GITHUB_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: message,
          content: content,
          sha: sha || undefined
        })
      });

      if (!response.ok) throw new Error(`GitHub Upload Error: ${response.statusText}`);
      const data = await response.json();
      return res.status(200).json(data);
    }

    if (action === 'github_delete') {
      const { owner, repo, path, sha, message } = payload;
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { 
          'Authorization': `token ${process.env.GITHUB_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message, sha })
      });

      if (!response.ok) throw new Error(`GitHub Delete Error`);
      return res.status(200).json({ success: true });
    }

    // --- AKSI TELEGRAM ---
    if (action === 'telegram_send') {
      const { chatId, text } = payload;
      const url = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`;
      
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: text })
      });
      
      return res.status(200).json({ success: true });
    }

    if (action === 'telegram_get_updates') {
      const { offset } = payload;
      const url = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/getUpdates?offset=${offset}&limit=5`;
      
      const response = await fetch(url);
      const data = await response.json();
      return res.status(200).json(data);
    }

    // --- AKSI GEMINI AI ---
    if (action === 'gemini_chat') {
      const { prompt } = payload;
      const apiKey = process.env.GEMINI_API_KEY;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      
      const aiResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { 
             parts: [{ text: `Kamu adalah asisten AI dari "Rendal Operasi & Niaga". Jawablah setiap pertanyaan pengguna secara bebas, santai, dan bersahabat.` }] 
          }
        })
      });

      const data = await aiResponse.json();
      return res.status(200).json(data);
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (error) {
    console.error("Proxy Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
