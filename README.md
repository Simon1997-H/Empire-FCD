# Empire Formwork Netlify Time Tracker

This is a Netlify-ready website with:

- `/admin.html` for admin access only
- `/worker.html` for workers to check in and check out
- shared online storage using Netlify Blobs
- Netlify Functions API under `/api/*`

## Admin passcode

Set this environment variable in Netlify:

```text
ADMIN_PASSCODE=your-secret-passcode
```

If you do not set it, the temporary default passcode is:

```text
1234
```

Change it before real use.

## Deploy to Netlify

Because this app uses Netlify Functions and Netlify Blobs, do not use basic Netlify Drop for the final live version.

Recommended:

1. Put this `empire-netlify-time-tracker` folder into a GitHub repository.
2. In Netlify, choose Add new site > Import an existing project.
3. Connect the GitHub repository.
4. Build command can be blank.
5. Publish directory should be:

```text
public
```

6. Functions directory is already set in `netlify.toml`.
7. Add the `ADMIN_PASSCODE` environment variable.
8. Deploy.

## Links after deploy

Use these links after Netlify gives you a domain:

```text
https://your-site.netlify.app/admin.html
https://your-site.netlify.app/worker.html
```

Give workers only the worker link.

## First setup

1. Open `/admin.html`.
2. Enter the admin passcode.
3. Add positions and hourly rates.
4. Add workers and optional PINs.
5. Add projects.
6. Add tasks.
7. Give workers the `/worker.html` link.

Workers check in and out from their phones. Finished shifts appear in admin as pending entries. Admin can approve, reject, or return entries to pending.

