// alcor-runner: compila y ejecuta el Solution.java que le manda Alcor.
// Es un servicio aparte, sin las credenciales de Alcor, para que el código de un candidato
// nunca corra junto a la contraseña de admin ni a los datos de otros candidatos.
//
// POST /run   (header X-Runner-Token, body = código Java)  →  JSON
//   { "compileError": "..." }  o  { "stdout": "...", "stderr": "...", "timeout": false, "exit": 0 }
// GET /healthz → ok

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

public class Runner {
    static final String TOKEN = System.getenv().getOrDefault("RUNNER_TOKEN", "");
    static final Semaphore SLOTS = new Semaphore(2); // máximo 2 ejecuciones a la vez (plan gratis: poca CPU)
    static final int MAX_SOURCE = 400_000, MAX_OUTPUT = 1_000_000;

    public static void main(String[] args) throws IOException {
        if (TOKEN.isEmpty()) System.err.println("[runner] RUNNER_TOKEN vacío: cualquiera podría usar este servicio");
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.setExecutor(Executors.newFixedThreadPool(8));
        server.createContext("/healthz", ex -> send(ex, 200, "text/plain", "ok"));
        server.createContext("/run", Runner::handleRun);
        server.start();
        System.out.println("[runner] escuchando en el puerto " + port);
    }

    static void handleRun(HttpExchange ex) throws IOException {
        try {
            if (!"POST".equals(ex.getRequestMethod())) { send(ex, 405, "text/plain", "method not allowed"); return; }
            String token = ex.getRequestHeaders().getFirst("X-Runner-Token");
            if (TOKEN.isEmpty() || token == null || !java.security.MessageDigest.isEqual(TOKEN.getBytes(), token.getBytes())) { send(ex, 401, "text/plain", "unauthorized"); return; }
            byte[] body = ex.getRequestBody().readNBytes(MAX_SOURCE + 1);
            if (body.length > MAX_SOURCE) { send(ex, 413, "text/plain", "too large"); return; }
            if (!SLOTS.tryAcquire(30, TimeUnit.SECONDS)) { send(ex, 503, "text/plain", "busy"); return; }
            try { send(ex, 200, "application/json", execute(new String(body, StandardCharsets.UTF_8))); }
            finally { SLOTS.release(); }
        } catch (Exception e) {
            send(ex, 500, "text/plain", "error: " + e.getMessage());
        }
    }

    static String execute(String source) throws Exception {
        Path dir = Files.createTempDirectory("alcor-");
        try {
            Files.writeString(dir.resolve("Solution.java"), source);
            Result c = exec(dir, 20, "javac", "-encoding", "UTF-8", "-nowarn", "-J-Xmx256m", "-d", dir.toString(), "Solution.java");
            if (c.exit != 0) return "{\"compileError\":" + json(c.err.isEmpty() ? c.out : c.err) + ",\"timeout\":" + c.timeout + "}";
            Result r = exec(dir, 10, "java", "-Xmx256m", "-Xss32m", "-XX:+UseSerialGC", "-XX:TieredStopAtLevel=1", "-Djava.awt.headless=true", "-cp", dir.toString(), "AlcorMain");
            return "{\"stdout\":" + json(r.out) + ",\"stderr\":" + json(r.err) + ",\"timeout\":" + r.timeout + ",\"exit\":" + r.exit + "}";
        } finally {
            try (var s = Files.walk(dir)) { s.sorted(Comparator.reverseOrder()).forEach(p -> p.toFile().delete()); }
        }
    }

    record Result(int exit, String out, String err, boolean timeout) {}

    static Result exec(Path dir, int seconds, String... cmd) throws Exception {
        ProcessBuilder pb = new ProcessBuilder(List.of(cmd)).directory(dir.toFile());
        Map<String, String> env = pb.environment();
        String path = env.getOrDefault("PATH", "/usr/bin:/bin"), javaHome = env.get("JAVA_HOME");
        env.clear(); // el código del candidato no ve RUNNER_TOKEN ni otras variables
        env.put("PATH", path); env.put("HOME", dir.toString()); env.put("LANG", "C.UTF-8");
        if (javaHome != null) env.put("JAVA_HOME", javaHome);
        Path outF = dir.resolve(".out"), errF = dir.resolve(".err");
        pb.redirectOutput(outF.toFile()).redirectError(errF.toFile());
        Process p = pb.start();
        boolean done = p.waitFor(seconds, TimeUnit.SECONDS);
        if (!done) { p.descendants().forEach(ProcessHandle::destroyForcibly); p.destroyForcibly(); p.waitFor(5, TimeUnit.SECONDS); }
        return new Result(done ? p.exitValue() : -1, read(outF), read(errF), !done);
    }

    static String read(Path f) throws IOException {
        if (!Files.exists(f)) return "";
        byte[] b = Files.readAllBytes(f);
        String s = new String(b, StandardCharsets.UTF_8);
        return s.length() > MAX_OUTPUT ? s.substring(s.length() - MAX_OUTPUT) : s;
    }

    static String json(String s) {
        StringBuilder b = new StringBuilder("\"");
        for (char ch : s.toCharArray()) {
            switch (ch) {
                case '"' -> b.append("\\\"");
                case '\\' -> b.append("\\\\");
                case '\n' -> b.append("\\n");
                case '\r' -> b.append("\\r");
                case '\t' -> b.append("\\t");
                default -> { if (ch < 0x20) b.append(String.format("\\u%04x", (int) ch)); else b.append(ch); }
            }
        }
        return b.append('"').toString();
    }

    static void send(HttpExchange ex, int status, String type, String body) throws IOException {
        byte[] b = body.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", type + "; charset=utf-8");
        ex.sendResponseHeaders(status, b.length);
        try (OutputStream os = ex.getResponseBody()) { os.write(b); }
    }
}
