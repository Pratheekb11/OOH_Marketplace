# Static frontend connection

The existing prototype is static HTML. `Ui_Prototype_MVP_Prep/js/api.js` supplies a minimal `api()` helper that:

- uses `window.OOH_API_BASE_URL` when supplied, otherwise `http://127.0.0.1:8000/api/v1`;
- attaches the saved JWT as a Bearer token;
- parses API errors into JavaScript errors.

`login_Page.html` now posts the email/password form to `/auth/login`, saves `access_token` in `localStorage`, then redirects to `listing_page.html`.

For a deployed environment, define the API base URL before loading `api.js`:

```html
<script>window.OOH_API_BASE_URL = "https://api.example.com/api/v1";</script>
<script src="./js/api.js"></script>
```

The other prototype pages still contain presentation-only controls. Wire them through the API reference:

- marketplace cards: `GET /listings` and `GET /listings/{id}`;
- owner submission: `POST /listings`, then multipart document upload;
- checkout: `POST /bookings`, followed by real provider checkout once implemented;
- dashboards: `GET /dashboard/advertiser`, `GET /dashboard/owner`, `GET /notifications` and `GET /invoices`.

Do not put secrets or payment-provider keys in frontend JavaScript. The API must remain the only caller of external providers.
