# Auth-Gated App Testing Playbook (Emergent Google Auth)

## Step 1: Create Test User & Session via mongosh
```
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  role: 'admin',
  settings: { llm_provider: 'openai', llm_model: 'gpt-4o-mini', custom_api_key: '' },
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

## Step 2: Test Backend
```
curl -X GET "$REACT_APP_BACKEND_URL/api/auth/me" -H "Authorization: Bearer <SESSION_TOKEN>"
curl -X GET "$REACT_APP_BACKEND_URL/api/interactions" -H "Authorization: Bearer <SESSION_TOKEN>"
curl -X POST "$REACT_APP_BACKEND_URL/api/seed-demo" -H "Authorization: Bearer <SESSION_TOKEN>"
```

## Step 3: Browser
```
await page.context.add_cookies([{
    "name": "session_token",
    "value": "<SESSION_TOKEN>",
    "domain": "quick-launch-133.preview.emergentagent.com",
    "path": "/",
    "httpOnly": true,
    "secure": true,
    "sameSite": "None"
}])
```

## Success
- /api/auth/me returns user
- Dashboard renders without redirect
- Seed endpoint returns created count
