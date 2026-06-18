# Upload These Files To GitHub

Upload the contents of this folder to a new GitHub repository.

Keep this folder structure exactly:

```text
netlify/
  functions/
    api.js
public/
  admin.html
  admin.js
  worker.html
  worker.js
  styles.css
  empire-formwork-logo.png
  index.html
netlify.toml
package.json
README.md
```

## Connect To Netlify

1. Open Netlify.
2. Choose **Add new site**.
3. Choose **Import an existing project**.
4. Connect the GitHub repository.
5. Leave build command blank.
6. Set publish directory to:

```text
public
```

7. Netlify will use `netlify.toml` for functions.

## Required Netlify Environment Variables

Add these in Netlify under **Site configuration > Environment variables**:

```text
ADMIN_PASSCODE=your-admin-passcode
NETLIFY_BLOBS_SITE_ID=your-netlify-site-id
NETLIFY_BLOBS_TOKEN=your-netlify-personal-access-token
```

Use:

```text
/admin
```

for admin, and:

```text
/worker
```

for workers.
