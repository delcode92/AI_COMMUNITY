# OWASP for AI Agents

**Context:** Security principles from OWASP adapted for AI agent systems.

## OWASP Top 10 for AI

### 1. Prompt Injection
Adversarial inputs that override system instructions.

**Mitigation:** 
- Input validation and sanitization
- Output filtering
- System prompt separation

### 2. Data Poisoning
Malicious training data corrupts model behavior.

**Mitigation:**
- Source verification
- Data validation pipelines
- Anomaly detection

### 3. Model Theft
API scraping to steal model weights or behavior.

**Mitigation:**
- Rate limiting
- Usage monitoring
- Watermarking outputs

### 4. Insecure Output Handling
Unsafe processing of LLM outputs.

**Mitigation:**
- Validate all outputs before use
- Sanitize for code/text execution
- Never trust LLM completely

### 5. Supply Chain Vulnerabilities
Compromised model weights or dependencies.

**Mitigation:**
- Verify model sources
- Dependency scanning
- Code signing

### 6. Excessive Agency
Agent has too much authority.

**Mitigation:**
- Least privilege principle
- Human approval for critical actions
- Audit logging

### 7. Insecure Plugin Design
Weak tool or plugin security.

**Mitigation:**
- Secure API design
- Authentication for tools
- Schema validation

### 8. Training Data Leakage
Training data memorization and extraction.

**Mitigation:**
- Differential privacy
- PII detection and filtering
- Model card documentation

### 9. Denial of Service
Resource exhaustion attacks.

**Mitigation:**
- Rate limiting
- Cost monitoring
- Circuit breakers

### 10. Misuse Potential
Agent capabilities used for harm.

**Mitigation:**
- Usage guidelines
- Content filters
- Usage monitoring

## Security Checklist for AI Agents

- [ ] Input validation on all prompts
- [ ] Output sanitization before tool execution
- [ ] Tool authentication and authorization
- [ ] Comprehensive logging and monitoring
- [ ] Rate limiting implemented
- [ ] Human review for critical actions
- [ ] Model and dependency verification

---

*Security best practices for AI agent systems.*
