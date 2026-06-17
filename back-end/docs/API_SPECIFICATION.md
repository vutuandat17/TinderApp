# TinderApp REST API Specification

## Document Status

**Version:** 1.0.0  
**Last Updated:** January 2024  
**Specification Format:** OpenAPI 3.0.3  
**Swagger UI:** http://localhost:5000/api-docs

---

## Overview

This document describes the RESTful API specification for the TinderApp backend. The API follows REST best practices and is fully documented in the [OpenAPI 3.0.3 specification](./openapi.yaml).

### Core Principles

1. **RESTful Resource-Oriented Design**
   - Resources as URLs: `/auth`, `/swipes`, `/matches`, `/chats`
   - Standard HTTP methods: GET (retrieve), POST (create), PATCH (partial update), DELETE (remove)
   - No verbs in URLs except for special actions

2. **Consistent Response Format**
   - All responses include appropriate HTTP status codes
   - Error responses follow standard format with message and optional details
   - Success responses wrapped with resource names (e.g., `{ user: {...} }`)

3. **Authentication & Security**
   - JWT Bearer token authentication on protected endpoints
   - Rate limiting with X-RateLimit-\* response headers
   - Token expiration: 7 days

4. **Pagination & Filtering**
   - Limit/offset pagination on list endpoints
   - Default limits and configurable maximums per endpoint
   - X-Total-Count header for result counts (future enhancement)

---

## API Endpoints Summary

### Authentication (POST-based)

| Method | Endpoint         | Purpose                           | Auth Required |
| ------ | ---------------- | --------------------------------- | ------------- |
| POST   | `/auth/register` | Create new user account           | No            |
| POST   | `/auth/login`    | Authenticate user, get JWT        | No            |
| GET    | `/auth/me`       | Get current user profile          | Yes           |
| PATCH  | `/auth/me`       | Update user profile (text fields) | Yes           |

### Photo Management

| Method | Endpoint                    | Purpose                  | Auth Required |
| ------ | --------------------------- | ------------------------ | ------------- |
| POST   | `/auth/me`                  | Upload new profile photo | Yes           |
| DELETE | `/auth/me/photos/{photoId}` | Delete profile photo     | Yes           |

**Notes:**

- Photo upload via multipart/form-data (separate from profile PATCH)
- Max 6 photos per user, max 5MB per file
- Supported formats: JPEG, PNG
- AI filter validates inappropriate content

### Discovery & Swiping

| Method | Endpoint           | Purpose                                   | Auth Required |
| ------ | ------------------ | ----------------------------------------- | ------------- |
| GET    | `/swipes/discover` | Get nearby users (discovery feed)         | Yes           |
| POST   | `/swipes`          | Create/update swipe (like/nope/superlike) | Yes           |

**Discovery Features:**

- Geo-based filtering (2dsphere index)
- Age range filtering via user preferences
- Excludes: already swiped users, current user, unmatched users
- Pagination: limit (default 10, max 100) + offset

**Swipe Actions:**

- `like`: Shows interest
- `nope`: Reject user
- `superlike`: Premium interest indicator
- Mutual `like` swipes create a Match

### Matching

| Method | Endpoint                     | Purpose                    | Auth Required |
| ------ | ---------------------------- | -------------------------- | ------------- |
| GET    | `/matches`                   | List user's active matches | Yes           |
| PATCH  | `/matches/{matchId}/unmatch` | Permanently remove a match | Yes           |

**Match Lifecycle:**

1. User A swipes "like" on User B
2. If User B also swipes "like" on User A → Match created
3. Both users see each other in `/matches` list
4. Either user can call `/unmatch` to remove (permanent, no re-matching)

### Chat/Messages

| Method | Endpoint                    | Purpose             | Auth Required |
| ------ | --------------------------- | ------------------- | ------------- |
| GET    | `/chats/{matchId}/messages` | Get message history | Yes           |
| POST   | `/chats/{matchId}/messages` | Send new message    | Yes           |

**Chat Features:**

- Real-time message delivery via WebSocket (Socket.IO)
- HTTP endpoints for history retrieval only
- Message read tracking (readBy array)
- AI filter validates message content
- Support for text + image messages

### System Endpoints

| Method | Endpoint  | Purpose             | Auth Required |
| ------ | --------- | ------------------- | ------------- |
| GET    | `/health` | Server health check | No            |

---

## Standard HTTP Status Codes

### Success Responses

| Code | Usage                                             |
| ---- | ------------------------------------------------- |
| 200  | GET successful, PATCH successful, general success |
| 201  | Resource created (POST)                           |
| 204  | Successful deletion (DELETE) - no content         |

### Client Error Responses

| Code | Usage                                     | Example                                          |
| ---- | ----------------------------------------- | ------------------------------------------------ |
| 400  | Bad request, validation error             | Invalid email format, weak password              |
| 401  | Unauthorized, missing/invalid token       | Missing Authorization header, expired token      |
| 403  | Forbidden, user not authorized            | User not part of match, insufficient permissions |
| 404  | Resource not found                        | Photo/match/user doesn't exist                   |
| 409  | Conflict, duplicate resource              | Email already registered                         |
| 422  | Unprocessable entity, AI filter violation | Unsafe content detected                          |

### Server Error Responses

| Code | Usage                           |
| ---- | ------------------------------- |
| 500  | Internal server error           |
| 503  | Service temporarily unavailable |

---

## Error Response Format

### Standard Error Response

```json
{
  "message": "Human-readable error message",
  "details": {
    "field": "field_name",
    "reason": "error_code"
  }
}
```

### Examples

**Validation Error (400):**

```json
{
  "message": "Password must be at least 8 characters"
}
```

**AI Filter Violation (422):**

```json
{
  "message": "Message contains unsafe content",
  "details": {
    "matchedTerm": "wire money",
    "category": "financial_scam"
  }
}
```

**Not Found (404):**

```json
{
  "message": "User with id user123 not found"
}
```

---

## Rate Limiting

### Rate Limit Tiers

1. **Standard Endpoints** (Discovery, Chat, Matches)
   - 100 requests per 15 minutes per IP
   - Applies to authenticated requests

2. **Auth Endpoints** (Register, Login)
   - 10 requests per 15 minutes per IP
   - Prevents brute force attacks

### Rate Limit Headers

All rate-limited responses include:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1705329900
```

**Interpretation:**

- `X-RateLimit-Limit`: Maximum requests allowed in window
- `X-RateLimit-Remaining`: Requests left in current window
- `X-RateLimit-Reset`: Unix timestamp when limit window resets

When limit exceeded → Response: **429 Too Many Requests**

---

## Authentication Flow

### 1. Registration

```
POST /auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123",
  "birthDate": "1995-06-15",
  "gender": "man"
}

Response: 201 Created
{
  "user": { ... user profile ... },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 2. Login

```
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123"
}

Response: 200 OK
{
  "user": { ... user profile ... },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 3. Using Token

```
GET /auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Response: 200 OK
{
  "user": { ... current user profile ... }
}
```

---

## Common Request/Response Examples

### Example 1: Complete Discovery & Swipe Flow

```
1. Get nearby users to swipe
   GET /swipes/discover?limit=10
   Authorization: Bearer <token>

   Response: 200 OK
   {
     "users": [
       {
         "_id": "user456",
         "name": "Jane Doe",
         "age": 26,
         "photos": [{ "url": "..." }],
         "distance": 2.5,
         "bio": "Adventure lover"
       }
     ]
   }

2. Swipe "like" on user456
   POST /swipes
   Authorization: Bearer <token>
   Content-Type: application/json

   {
     "target": "user456",
     "direction": "like"
   }

   Response: 201 Created
   {
     "swipe": { "id": "swipe123", ... },
     "isMatch": false  // User456 hasn't liked back yet
   }

3. If user456 also swiped "like" → Match created
   Response: 201 Created
   {
     "swipe": { ... },
     "isMatch": true,  // Mutual like!
     "match": { "id": "match123", "users": [...] }
   }
```

### Example 2: Chat Message

```
POST /chats/match123/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "text": "Hi! How are you?",
  "imageUrl": null
}

Response: 201 Created
{
  "message": {
    "_id": "msg456",
    "match": "match123",
    "sender": { "_id": "user123", "name": "John Doe" },
    "text": "Hi! How are you?",
    "readBy": [],
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

---

## Security Best Practices

1. **Always use HTTPS in production** (http:// only for local development)

2. **Token Management**
   - Store token securely (httpOnly cookie or secure storage)
   - Include token in Authorization header with "Bearer" scheme
   - Token expires after 7 days; implement refresh flow if needed

3. **AI Content Filter**
   - Applies to: user registration, profile updates, chat messages, photo uploads
   - Returns 422 Unprocessable Entity if unsafe content detected
   - Check `details.matchedTerm` for what triggered the filter

4. **Rate Limiting**
   - Implement exponential backoff when receiving 429 responses
   - Check X-RateLimit-Reset to determine when to retry

5. **Input Validation**
   - Email: Valid format, verified during registration
   - Password: Min 8 chars, required for registration/profile changes
   - Location: Valid lat/long coordinates
   - File uploads: Max 5MB, JPEG/PNG only

---

## Websocket Events (Real-time Chat)

**Note:** Chat messages also available via HTTP polling using GET `/chats/{matchId}/messages`, but WebSocket recommended for real-time experience.

### Connection

```javascript
import io from "socket.io-client";

const socket = io("http://localhost:5000", {
  auth: {
    token: "JWT_TOKEN_HERE",
  },
});
```

### Events

- `message:new` - Receive new message in real-time
- `message:read` - Notification when message is read
- `match:new` - New match created
- `reconnect` - Connection re-established (auto-implemented by Socket.IO)

---

## API Versioning

**Current Version:** 1.0.0

Future versions will be accessible via URL prefix: `/api/v2`, `/api/v3`, etc.

**Breaking Changes Policy:**

- Major version for breaking changes
- Minor version for new features (backward compatible)
- Patch version for bug fixes

---

## Development vs Production

### Local Development

```
Base URL: http://localhost:5000/api
Swagger UI: http://localhost:5000/api-docs
Token expiry: 7 days (development)
Rate limiting: Enabled but lenient
```

### Production

```
Base URL: https://api.tinderapp.com/api
Swagger UI: https://api.tinderapp.com/api-docs
Token expiry: 7 days (production)
Rate limiting: Strict limits enforced
HTTPS: Required
CORS: Configured for frontend domain only
```

---

## Future Enhancements (Roadmap)

- [ ] POST /swipes/{swipeId}/undo - Undo a swipe
- [ ] GET /swipes - List user's swipe history
- [ ] POST /matches/{matchId}/block - Block user
- [ ] GET /users/{userId} - Public user profile (limited info)
- [ ] WebSocket message pagination
- [ ] Push notification subscriptions
- [ ] User report/complaint system
- [ ] Search/filter by interests
- [ ] Video verification endpoint

---

## Support & Documentation

- **OpenAPI Spec:** [openapi.yaml](./openapi.yaml)
- **Interactive Docs:** Swagger UI at `/api-docs`
- **Error Codes:** See Status Codes section above
- **Examples:** See Common Requests section above
