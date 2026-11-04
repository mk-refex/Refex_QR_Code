const status = require("../../helpers/Response");
const winterSpinService = require("../../services/winterSpinService");

function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || null;
}

function extractApiKey(req) {
  const header = req.headers["x-api-key"] || req.headers["x-winter-spin-key"] || "";
  if (header) return String(header);
  const auth = req.headers.authorization || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return req.body?.apiKey || req.body?.api_key || "";
}

module.exports = {
  getStatus: async (req, res) => {
    try {
      const phone = req.query.phone || req.query.mobile || "";
      const name = req.query.name || req.query.full_name || "";
      const token = req.query.token || "";

      const result = await winterSpinService.getStatus({ phone, name, token });
      if (!result.ok) {
        return status.ResponseStatus(res, result.status || 403, result.error);
      }
      return status.ResponseStatus(res, 200, "OK", result);
    } catch (error) {
      console.error("Winter spin status error:", error);
      return status.ResponseStatus(
        res,
        500,
        "Unable to load spin status. Please try again."
      );
    }
  },

  /**
   * Trusted callers only (Google Apps Script / backend).
   * POST /api/winter-spin/issue
   * Header: X-API-Key: <WINTER_SPIN_API_KEY>
   * Body: { name, phone }
   */
  issue: async (req, res) => {
    try {
      const name = req.body.name || req.body.full_name || "";
      const phone = req.body.phone || req.body.mobile || req.body.mobile_number || "";
      const apiKey = extractApiKey(req);

      const result = await winterSpinService.issueSpinToken({ name, phone, apiKey });
      if (!result.ok) {
        return status.ResponseStatus(res, result.status || 400, result.message);
      }

      return status.ResponseStatus(res, 200, "Token issued.", {
        token: result.token,
        expiresAt: result.expiresAt,
        spinUrl: result.spinUrl,
        reused: result.reused,
      });
    } catch (error) {
      console.error("Winter spin issue error:", error);
      return status.ResponseStatus(
        res,
        500,
        "Unable to issue spin token. Please try again."
      );
    }
  },

  spin: async (req, res) => {
    try {
      const name = req.body.name || req.body.full_name || "";
      const phone = req.body.phone || req.body.mobile || req.body.mobile_number || "";
      const token = req.body.token || "";

      const result = await winterSpinService.spinOnce({
        name,
        phone,
        token,
        ip: clientIp(req),
        userAgent: req.headers["user-agent"],
      });

      if (!result.ok) {
        return status.ResponseStatus(res, result.status || 400, result.message);
      }

      return status.ResponseStatus(res, 200, "Spin result ready.", {
        alreadySpun: result.alreadySpun,
        weekKey: result.weekKey,
        entry: result.entry,
      });
    } catch (error) {
      console.error("Winter spin error:", error);
      return status.ResponseStatus(
        res,
        500,
        "Unable to complete your spin. Please try again."
      );
    }
  },
};
