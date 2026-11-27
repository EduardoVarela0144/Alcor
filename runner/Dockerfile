# alcor-runner: ejecuta el código Java de los candidatos (ver Runner.java).
FROM eclipse-temurin:21-jdk
WORKDIR /app
COPY Runner.java .
RUN javac -d /app Runner.java
# Usuario sin privilegios para ejecutar el código de los candidatos
RUN useradd --create-home --shell /usr/sbin/nologin runner
USER runner
ENV PORT=8080
EXPOSE 8080
CMD ["java", "-Xmx128m", "-cp", "/app", "Runner"]
