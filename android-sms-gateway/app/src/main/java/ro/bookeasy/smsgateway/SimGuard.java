package ro.bookeasy.smsgateway;

public final class SimGuard {
    private SimGuard() {}
    public static String normalize(String value) {
        String digits = value == null ? "" : value.replaceAll("[^0-9]", "");
        if (digits.startsWith("00")) digits = digits.substring(2);
        if (digits.matches("0[0-9]{9}")) digits = "40" + digits.substring(1);
        return digits.matches("[1-9][0-9]{7,14}") ? "+" + digits : "";
    }
    public static void requireMatch(String expected, String detected) {
        String left = normalize(expected), right = normalize(detected);
        if (left.isEmpty() || right.isEmpty() || !left.equals(right)) throw new IllegalStateException("SIM-ul nu corespunde numărului din BookEasy. Trimiterea este blocată.");
    }
}
