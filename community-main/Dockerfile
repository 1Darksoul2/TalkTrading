# Multi-stage Dockerfile for TalkTrading Community Microservice (Java 23)
# FROM eclipse-temurin:23-jdk-alpine AS builder
# WORKDIR /app
# COPY pom.xml .
# COPY src ./src
# COPY mvnw .
# COPY mvnw.cmd .
# COPY .mvn ./.mvn
# RUN ./mvnw clean package -DskipTests || mvn clean package -DskipTests

# FROM eclipse-temurin:23-jre-alpine
# WORKDIR /app
# COPY --from=builder /app/target/community-service-*.jar app.jar
# EXPOSE 8080
# ENTRYPOINT ["java", "-jar", "app.jar"]
FROM eclipse-temurin:23-jdk-alpine AS builder

WORKDIR /app

# Install Maven
RUN apk add --no-cache maven

# Copy project files
COPY pom.xml .
COPY src ./src

# Build application
RUN mvn clean package -DskipTests

# Runtime image
FROM eclipse-temurin:23-jre-alpine

WORKDIR /app

COPY --from=builder /app/target/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
