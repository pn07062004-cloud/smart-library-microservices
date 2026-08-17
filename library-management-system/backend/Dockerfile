FROM maven:3.9.11-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY . .
ARG MODULE
RUN mvn -B -pl ${MODULE} -am clean package -DskipTests
FROM eclipse-temurin:21-jre
WORKDIR /app
ARG MODULE
COPY --from=build /workspace/${MODULE}/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java","-jar","app.jar"]

