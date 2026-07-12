/// Mirrors the feature catalog seeded backend-side in prisma/seed-billing-plans.ts.
const Map<String, String> billingFeatureLabels = {
  'users': 'Team members',
  'storage': 'Storage',
  'ai_requests': 'AI requests',
  'ai_tokens': 'AI tokens',
  'workflow_executions': 'Workflow executions',
  'crm_records': 'CRM records',
  'communications': 'Messages sent/received',
  'email_accounts': 'Connected email accounts',
  'whatsapp_messages': 'WhatsApp messages',
  'voice_minutes': 'Voice minutes',
  'sms_messages': 'SMS messages',
  'calendar_connections': 'Calendar connections',
  'api_requests': 'API requests',
  'attachments': 'Attachments',
  'integrations': 'Active integrations',
  'seats': 'Seats',
};

String billingFeatureLabel(String featureKey) => billingFeatureLabels[featureKey] ?? featureKey;

String formatBillingCurrency(num value, {String currency = 'USD'}) {
  final symbol = currency.toUpperCase() == 'USD' ? '\$' : '${currency.toUpperCase()} ';
  return '$symbol${value.toStringAsFixed(0)}';
}

String formatBillingCount(num value) {
  if (value >= 1000000) {
    return '${(value / 1000000).toStringAsFixed(1)}M';
  }
  if (value >= 1000) {
    return '${(value / 1000).toStringAsFixed(1)}K';
  }
  return value.toStringAsFixed(0);
}

String formatBillingBytes(num bytes) {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  var value = bytes.toDouble();
  var unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return '${unitIndex == 0 ? value.toStringAsFixed(0) : value.toStringAsFixed(1)} ${units[unitIndex]}';
}

String formatBillingQuantity(num quantity, String unit) {
  if (unit == 'BYTES') return formatBillingBytes(quantity);
  if (unit == 'MINUTES') return '${formatBillingCount(quantity)} min';
  return formatBillingCount(quantity);
}

String formatBillingDate(String iso) {
  try {
    final date = DateTime.parse(iso).toLocal();
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return '${months[date.month - 1]} ${date.day}, ${date.year}';
  } catch (_) {
    return iso;
  }
}
