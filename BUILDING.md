# Сборка xalle-native в APK

## Способы сборки

| Способ | Сложность | Требования | Результат |
|--------|-----------|------------|-----------|
| **EAS Build (облако)** | Низкая | Аккаунт Expo | APK/AAB |
| **Локальная сборка** | Высокая | Android Studio + JDK | APK |

---

## Способ 1: EAS Build (рекомендуется)

Expo собирает APK на своих серверах — ничего дополнительно устанавливать не нужно.

### 1.1 Установка EAS CLI

```bash
npm install -g eas-cli
```

### 1.2 Вход в Expo аккаунт

```bash
eas login
```

> Если аккаунта нет — зарегистрируйтесь на [expo.dev](https://expo.dev)

### 1.3 Инициализация проекта (один раз)

```bash
cd xalle-native
eas build:configure
```

Команда создаст `eas.json`. Замени его содержимое на:

```json
{
  "cli": {
    "version": ">= 14.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "aab"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

### 1.4 Сборка APK

**Тестовый APK** (для установки напрямую):
```bash
eas build --platform android --profile preview
```

**Релизный AAB** (для Google Play):
```bash
eas build --platform android --profile production
```

**APK без аккаунта (локально через EAS)**:
```bash
eas build --platform android --profile preview --local
```
> Требует Android Studio и JDK 17 (см. Способ 2)

### 1.5 Скачать APK

После завершения сборки EAS выдаст ссылку для скачивания. Также файл появится на [expo.dev/builds](https://expo.dev/builds).

---

## Способ 2: Локальная сборка (без облака)

### 2.1 Требования

- **JDK 17**: [adoptium.net](https://adoptium.net) → скачать Temurin 17
- **Android Studio**: [developer.android.com/studio](https://developer.android.com/studio)
  - После установки: SDK Manager → установить Android SDK (API 34)
- **Переменные среды**:
  ```
  JAVA_HOME = C:\Program Files\Eclipse Adoptium\jdk-17.x.x-hotspot
  ANDROID_HOME = C:\Users\<username>\AppData\Local\Android\Sdk
  ```
  Добавить в PATH:
  ```
  %ANDROID_HOME%\platform-tools
  %ANDROID_HOME%\tools
  ```

### 2.2 Создание нативного проекта

```bash
cd xalle-native
npx expo prebuild --platform android --clean
```

> Команда создаёт папку `android/` с нативным проектом.

### 2.3 Сборка debug APK

```bash
cd android
.\gradlew assembleDebug
```

Готовый файл: `android\app\build\outputs\apk\debug\app-debug.apk`

### 2.4 Сборка release APK

#### Создать keystore (один раз)

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore xalle-release.keystore -alias xalle -keyalg RSA -keysize 2048 -validity 10000
```

Запомни: alias (`xalle`), пароль keystore и пароль ключа.

#### Настроить подпись

Открыть `android/app/build.gradle`, найти `android { ... }` и добавить:

```gradle
android {
    ...
    signingConfigs {
        release {
            storeFile file("../../xalle-release.keystore")
            storePassword "ВАШ_ПАРОЛЬ"
            keyAlias "xalle"
            keyPassword "ВАШ_ПАРОЛЬ"
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
        }
    }
}
```

#### Собрать release APK

```bash
cd android
.\gradlew assembleRelease
```

Готовый файл: `android\app\build\outputs\apk\release\app-release.apk`

---

## Установка APK на устройство

### Через ADB (USB)

```bash
# Подключи телефон, включи USB Debugging
adb install app-release.apk
```

### Через файл

1. Скопировать APK на телефон (USB / Telegram / email)
2. Открыть файловый менеджер → найти APK
3. Нажать → разрешить установку из неизвестных источников

---

## Настройка app.json перед сборкой

Перед сборкой проверь `xalle-native/app.json`:

```json
{
  "expo": {
    "name": "xalle",
    "slug": "xalle-native",
    "version": "1.0.0",
    "android": {
      "package": "com.xalle.app",
      "versionCode": 1,
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#faf7f2"
      }
    }
  }
}
```

> `package` должен быть уникальным (обратный домен, напр. `com.xalle.app`)  
> `versionCode` увеличивай на 1 при каждом обновлении

---

## Частые проблемы

| Проблема | Решение |
|----------|---------|
| `JAVA_HOME not set` | Установить JDK 17, прописать в переменные среды |
| `SDK location not found` | Открыть Android Studio, установить SDK через SDK Manager |
| `Keystore error` | Проверить путь к keystore и пароли в build.gradle |
| `Metro bundler error` | `npx expo start --clear` в папке xalle-native |
| Приложение вылетает | Собрать debug APK и проверить логи: `adb logcat` |

---

## Быстрый старт (EAS, самый простой вариант)

```bash
# Установить EAS CLI (один раз)
npm install -g eas-cli

# Войти в аккаунт
eas login

# Из папки xalle-native:
eas build --platform android --profile preview
```

Через 5–15 минут получишь ссылку на APK.
