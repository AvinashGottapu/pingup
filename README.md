# PingUp 🚀

## Overview

PingUp is a real-time communication platform built using React, Node.js, Socket.IO, and WebRTC. It enables users to make peer-to-peer voice calls, share screens during conversations, and communicate with low latency using WebRTC-based media streaming and Socket.IO signaling.

---

## Features

* 📞 One-to-One Voice Calling using WebRTC
* 🖥️ Real-Time Screen Sharing
* ⚡ Socket.IO-based Signaling System
* 🔄 SDP Offer/Answer & ICE Candidate Exchange
* 🔐 Secure Authentication with Clerk
* 📱 Responsive Design for Desktop and Mobile
* 🎙️ Mute / Unmute Controls
* 🔊 Speaker Controls
* 🗂️ Room-based Communication Architecture
* 📉 Call Minimize and Restore Functionality

---

## Tech Stack

### Frontend

* React.js
* Redux Toolkit
* Tailwind CSS
* Socket.IO Client
* WebRTC
* Clerk Authentication

### Backend

* Node.js
* Express.js
* Socket.IO
* MongoDB

---

## Architecture

```text
Frontend (React)
        │
        ▼
Socket.IO Signaling Server
        │
        ▼
WebRTC Peer Connection
        │
        ▼
Voice Communication & Screen Sharing
```

---

## WebRTC Call Flow

```text
User A joins room
      ↓
User B joins room
      ↓
Offer Creation
      ↓
Answer Creation
      ↓
ICE Candidate Exchange
      ↓
Peer-to-Peer Connection
      ↓
Voice Communication
```

---

## Screen Sharing Flow

```text
User clicks Share Screen
      ↓
getDisplayMedia()
      ↓
Screen Video Track Created
      ↓
Track Added to Existing PeerConnection
      ↓
Renegotiation Triggered
      ↓
New SDP Offer & Answer Exchange
      ↓
Remote User Receives Shared Screen
```

---

## Project Structure

```text
PingUp
│
├── frontend
│   ├── components
│   ├── pages
│   ├── api
│   ├── hooks
│   ├── features
│   └── redux
│
├── backend
│   ├── controllers
│   ├── routes
│   ├── middleware
│   ├── socket
│   └── models
│
└── README.md
```

---

## Installation

### Clone Repository

```bash
git clone https://github.com/AvinashGottapu/pingup.git
cd pingup
```

### Install Frontend Dependencies

```bash
cd frontend
npm install
```

### Install Backend Dependencies

```bash
cd backend
npm install
```

---

## Environment Variables

Create a `.env` file and configure:

```env
PORT=5000

MONGODB_URI=your_mongodb_connection_string

CLERK_SECRET_KEY=your_clerk_secret
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key

JWT_SECRET=your_secret
```

---

## Run Application

### Backend

```bash
npm run dev
```

### Frontend

```bash
npm run dev
```

---

## Key Concepts Used

### WebRTC

* Peer-to-peer communication
* SDP Offer / Answer mechanism
* ICE Candidate exchange
* NAT Traversal using STUN servers

### Socket.IO

* Real-time signaling
* Room-based communication
* Event-driven architecture

### Authentication

* User authentication using Clerk
* Protected routes
* Secure socket connections

---

## Future Enhancements

* 🎥 Video Calling
* 📝 Collaborative Whiteboard (Canvas + Socket.IO)
* 👥 Group Calls
* 📂 File Sharing
* 📹 Call Recording
* 🔔 Push Notifications
* 🌐 End-to-End Encryption
* 📊 Call Analytics

---

## What I Learned

Through PingUp, I gained hands-on experience with:

* WebRTC Fundamentals
* Socket.IO and Real-Time Communication
* SDP Offers and Answers
* ICE Candidate Exchange
* Screen Sharing Implementation
* Authentication & Authorization
* React State Management
* Peer-to-Peer Networking Concepts
* Building Production-Ready Full Stack Applications

---

## Author

**Avinash Gottapu**

Passionate about Full Stack Development, Real-Time Communication Systems, Competitive Programming, and Software Engineering.

GitHub: https://github.com/AvinashGottapu
