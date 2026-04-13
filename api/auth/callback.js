export default async function handler(req, res) {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing code');

  const CLIENT_ID     = '1493173314955247686';
  const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || 'fGu7H9MoDFLyoB2sCMR5DWUBbtagh8n7';
  const REDIRECT_URI  = 'https://vortex-ac.com/api/auth/callback';
  const API_URL       = 'https://api.vortex-ac.com';
  const DASHBOARD_URL = 'https://www.vortex-ac.com/panel/';
  const WEBHOOK_URL   = 'https://discord.com/api/webhooks/1492924150564520106/vxvsteERybOi-l8FKSI1wtcfZB1ZfCZWgG43GuEYdyxeAQ895ay91GuCPOX7zqhMHMQd';

  // Exchange code for Discord access token
  const tokenResp = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!tokenResp.ok) {
    const err = await tokenResp.text();
    return res.status(400).send(`Discord auth failed: ${err}`);
  }

  const { access_token } = await tokenResp.json();

  // Get Discord user info
  const userResp = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!userResp.ok) return res.status(400).send('Failed to get user info');

  const user = await userResp.json();
  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    : `https://cdn.discordapp.com/embed/avatars/0.png`;

  // Create session on Render API
  let sessionToken = '';
  try {
    const sessResp = await fetch(API_URL + '/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id:  user.id,
        username: user.username,
        email:    user.email || 'N/A',
        avatar:   avatarUrl,
      }),
    });
    const sessData = await sessResp.json();
    sessionToken = sessData.token || '';
  } catch (e) {}

  // Send webhook log
  try {
    const now = new Date().toUTCString();
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: '✅ Login Granted',
          color: 0x22c55e,
          thumbnail: { url: avatarUrl },
          fields: [
            { name: 'Username', value: `\`${user.username}\``, inline: true },
            { name: 'User ID',  value: `\`${user.id}\``,       inline: true },
            { name: 'Email',    value: `\`${user.email || 'N/A'}\``, inline: false },
          ],
          footer: { text: `Vortex AC Login • ${now}` },
        }],
      }),
    });
  } catch (e) {}

  // Redirect to dashboard with session token
  res.redirect(`${DASHBOARD_URL}?token=${sessionToken}&uid=${user.id}&uname=${encodeURIComponent(user.username)}`);
}
