👋 Welcome to DepiPay support! I can help you accept crypto payments or find the right place. Pick a topic below — or just type your question.

💬 Ask the AI assistant
🚀 API integration
🧾 Invoices & payments
💳 Deposits & withdrawals
🌐 Chains, tokens & fees
👛 Supported wallets
🔐 Security & custody
🛟 Contact a human
🚀 API integration
API integration — DepiPay

DepiPay is a non-custodial payment gateway. The core flow is two calls:

Create an invoice — POST /invoice from your backend.
Poll for events — POST /poll/events to learn when it's paid.
Base URL: https://api.depipay.com

👉 See the in-app integration guide for full details, examples and keys.

🧾 Create an invoice (POST /invoice)
🔔 Polling notifications (POST /poll/events)
🔑 Authentication & session keys
🧩 SDK & CMS plugins
📖 Integration guide (more details)
⬅ Back
🧾 Create an invoice (POST /invoice)
Create an invoice

POST /invoice with at least value, chainId, description, and acceptedTokens. Returns 201 Created with the deposit address and a hosted paymentUrl you can redirect the buyer to. Optional: deadlineSecs, merchant data, or a pinned address for tip-jar flows.

acceptedTokens is a whitelist of "{chainId}:{tokenAddressLower}" (use the zero address for a chain's native coin). Example — USDT on Ethereum + BSC:

"acceptedTokens": [
  "1:0xdac17f958d2ee523a2206206994597c13d831ec7",
  "56:0x55d398326f99059ff775485246999027b3197955"
]
🔔 How do I get paid-notifications?
📖 Integration guide
⬅ Back
🔔 Polling notifications (POST /poll/events)
Polling notifications

Poll POST /poll/events from your backend (or a cron/serverless job). Each call drains the events queued since your last poll and returns the full Invoice JSON — compare the status field against your stored copy to see what changed.

Events are queued reliably, so polling on an interval (every few seconds) never misses a payment. Dedupe by (guid, status) to stay idempotent.

🧾 Create an invoice
📖 Integration guide
⬅ Back
🔑 Authentication & session keys
Authentication (session keys)

Your backend generates a secp256k1 session key. The merchant's main wallet (MetaMask/TronLink) signs a one-time registration to bind it — after that every request is signed silently, no wallet popup per invoice. A session key can call the API but cannot move funds, so a leak can't drain the wallet.

Every authenticated request carries two headers:

x-session-nonce — strictly-increasing integer (ms timestamp works)
x-session-signature — EIP-191 signature over sess:{nonce}:{sha256(body)}
For GET reads, sign the request URI (path + query) instead of the body hash so a captured header can't be replayed against another resource.

🧾 Create an invoice
👛 Supported wallets
📖 Integration guide
⬅ Back
🧾 Invoices & payments
Invoices & payments

Each invoice gets its own smart-wallet deposit address. Customers can pay with any accepted token, and you're notified the moment they pay.

How do I create an invoice?
How do I know when a customer paid?
What if the buyer under/overpays?
Open the dashboard
⬅ Back
How do I create an invoice?
Create invoices from Invoices → New in the dashboard (or via the API): set the amount, currency and accepted tokens, then share the generated payment link. A fresh deposit address is assigned automatically.

Open the dashboard
⬅ Back