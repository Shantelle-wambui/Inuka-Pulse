# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM eclipse-temurin:17-jdk-jammy AS build

WORKDIR /app

# Install unzip — required by the Maven wrapper to extract the Maven distribution
RUN apt-get update -q && apt-get install -y --no-install-recommends unzip && rm -rf /var/lib/apt/lists/*

# Copy the Maven wrapper and POM first so Docker can cache the dependency layer
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN ./mvnw dependency:go-offline -q

# Copy source and build the fat JAR (skip tests — they need a DB)
COPY src/ src/
RUN ./mvnw package -DskipTests -q

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM eclipse-temurin:17-jre-jammy AS runtime

WORKDIR /app

# Copy only the fat JAR from the build stage
COPY --from=build /app/target/*.jar app.jar

# Railway/Docker injects SPRING_PROFILES_ACTIVE at runtime.
# Shell form is used so the variable is evaluated when the container starts.
ENV SPRING_PROFILES_ACTIVE=docker

EXPOSE 8080

ENTRYPOINT java -Dspring.profiles.active=${SPRING_PROFILES_ACTIVE} -jar app.jar
