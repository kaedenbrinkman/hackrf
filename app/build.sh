#/bin/bash
npm run build && aws cloudfront create-invalidation --distribution-id E2Z6KIZA4GAZ7H --paths '/*' && clear