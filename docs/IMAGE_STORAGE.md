# Image Storage Configuration

This project keeps the current hosting image flow as the default.

Optional image storage variables:

```env
IMAGE_STORAGE_MODE=hosting
IMAGE_CDN_BASE_URL=
B2_BUCKET_NAME=
B2_KEY_ID=
B2_APPLICATION_KEY=
B2_ENDPOINT=
```

Modes:

- `hosting`: current behavior. Images are copied into the generated catalog package and served from the hosting.
- `backblaze`: remote/CDN image URLs are preferred.
- `hybrid`: remote/CDN image URLs are preferred, with fallback to the current hosting image path.

Security notes:

- Keep real credentials in a private `.env` file or local machine settings only.
- Do not commit `.env`, Backblaze keys, bucket secrets, or production `config.php`.
- The checked-in `.env.example` is only a template and contains no secrets.

Current phase:

- These values are documented and safe to configure later.
- Runtime behavior remains unchanged until the storage resolver/uploader phases are implemented.

## Backblaze setup

Recommended bucket settings:

- Bucket type: `Public`
- Object Lock: disabled
- Default encryption: optional; disabled keeps the simplest public/CDN flow
- Endpoint example: `https://s3.us-east-005.backblazeb2.com`

Create an application key scoped to the image bucket with read/write permissions. Store the real secret only in a private `.env` file.

Example local `.env`:

```env
IMAGE_STORAGE_MODE=hybrid
IMAGE_CDN_BASE_URL=https://f005.backblazeb2.com/file/rodeo-catalogos-img
B2_BUCKET_NAME=rodeo-catalogos-img
B2_KEY_ID=your_key_id
B2_APPLICATION_KEY=your_private_application_key
B2_ENDPOINT=https://s3.us-east-005.backblazeb2.com
```

## Using the app

- `Hosting actual`: default. Keeps the current hosting image flow.
- `Backblaze B2/CDN`: uploads catalog images to B2/CDN and prefers remote URLs.
- `Hibrido recomendado`: uploads to B2/CDN, prefers remote URLs, and keeps hosting/local fallback.

Backblaze upload logs are written inside the exported package:

```text
logs/backblaze-upload.log
```

## CDN

`IMAGE_CDN_BASE_URL` should be the public base URL that serves files from the bucket. It can be:

- A direct Backblaze public bucket URL.
- A CDN pull zone/custom domain in front of the bucket.

The final object URLs are built as:

```text
IMAGE_CDN_BASE_URL/catalogos/{slug}/{archivo}
```

## Safe rollback

Set the storage mode back to hosting:

```env
IMAGE_STORAGE_MODE=hosting
```

Then regenerate/export/publish the catalog. Existing hosting image paths remain available because local package images are still copied.
