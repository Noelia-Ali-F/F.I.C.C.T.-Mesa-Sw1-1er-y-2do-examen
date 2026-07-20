class AppConfig {
  static const String defaultApiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://3.92.42.41:8080',
  );

  static Uri apiUri(String path, [Map<String, String>? query]) {
    final sanitizedBase =
        defaultApiBaseUrl.endsWith('/')
            ? defaultApiBaseUrl.substring(0, defaultApiBaseUrl.length - 1)
            : defaultApiBaseUrl;
    final base = Uri.parse(sanitizedBase);

    return base.replace(path: '${base.path}$path', queryParameters: query);
  }
}
