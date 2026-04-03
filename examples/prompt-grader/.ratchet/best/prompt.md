Classify the following product review as positive, negative, or neutral.

Review: {{review}}

Examples:
- "Good product but shipping took forever" → {"sentiment": "positive", "confidence": 0.7}
- "Works well but overpriced compared to competitors" → {"sentiment": "neutral", "confidence": 0.6}
- "Sure, it 'works' if your definition of working includes crashing every hour" → {"sentiment": "negative", "confidence": 0.9}

Respond with a JSON object with the fields "sentiment" and "confidence". Confidence should be a number between 0 and 1. Output only the JSON object, no other text.