package com.sentinel.common.config;

import com.sentinel.site.SiteEntity;
import com.sentinel.site.SiteRepository;
import com.sentinel.user.AppRoleEntity;
import com.sentinel.user.AppRoleRepository;
import com.sentinel.user.AppUserEntity;
import com.sentinel.user.AppUserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DataSeeder — runs once at startup after the JPA schema is created.
 *
 * Seeds in order:
 *   1. RBAC roles
 *   2. Inuka cohort sites (dim_site) — needed before ETL can load incidents
 *   3. Default user accounts
 *
 * Every insert is idempotent — safe to run on every restart.
 *
 * Login credentials (all use password: sentinel@admin):
 *   admin@inuka.org        — Admin
 *   director@inuka.org     — Program Director (HSE Manager role)
 *   officer@inuka.org      — Field Officer (Field Technician role)
 *   analyst@inuka.org      — Analyst
 *   ml.admin@inuka.org     — ML Admin
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataSeeder implements ApplicationRunner {

    private final AppUserRepository userRepository;
    private final AppRoleRepository roleRepository;
    private final SiteRepository    siteRepository;
    private final PasswordEncoder   passwordEncoder;

    private static final String DEFAULT_PASSWORD = "sentinel@admin";

    private static final List<String> ROLE_NAMES = List.of(
        "Admin", "HSE Manager", "Auditor", "Analyst", "Viewer",
        "Field Technician", "Station Manager", "ML Admin"
    );

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        seedRoles();
        seedSites();
        seedUsers();
    }

    // ── 1. Roles ──────────────────────────────────────────────────────────────

    private void seedRoles() {
        int created = 0;
        for (String roleName : ROLE_NAMES) {
            if (roleRepository.findByNameIgnoreCase(roleName).isPresent()) continue;
            AppRoleEntity role = new AppRoleEntity();
            role.setName(roleName);
            role.setDescription(roleName + " role");
            role.setCreatedAt(LocalDateTime.now());
            roleRepository.save(role);
            created++;
        }
        if (created > 0) log.info("DataSeeder: seeded {} role(s)", created);
    }

    // ── 2. Inuka cohort sites ─────────────────────────────────────────────────

    private record CohortSite(String id, String name, String location) {}

    private static final List<CohortSite> COHORT_SITES = List.of(
        // Scholarship pillar
        new CohortSite("cohort-sc-001", "Scholarship — Nairobi",  "Nairobi County, Kenya"),
        new CohortSite("cohort-sc-002", "Scholarship — Mombasa",  "Mombasa County, Kenya"),
        new CohortSite("cohort-sc-003", "Scholarship — Nakuru",   "Nakuru County, Kenya"),
        new CohortSite("cohort-sc-007", "Scholarship — Kisumu",   "Kisumu County, Kenya"),
        // Plus pillar
        new CohortSite("cohort-pl-001", "Plus — Nairobi",         "Nairobi County, Kenya"),
        new CohortSite("cohort-pl-007", "Plus — Kisumu",          "Kisumu County, Kenya"),
        // Vocational pillar
        new CohortSite("cohort-vn-001", "Vocational — Nairobi",   "Nairobi County, Kenya"),
        new CohortSite("cohort-vn-003", "Vocational — Nakuru",    "Nakuru County, Kenya"),
        new CohortSite("cohort-vn-026", "Vocational — Eldoret",   "Uasin Gishu County, Kenya"),
        // Tech pillar
        new CohortSite("cohort-tc-001", "Tech — Nairobi",         "Nairobi County, Kenya"),
        new CohortSite("cohort-tc-002", "Tech — Mombasa",         "Mombasa County, Kenya"),
        new CohortSite("cohort-tc-007", "Tech — Kisumu",          "Kisumu County, Kenya")
    );

    private void seedSites() {
        int created = 0;
        for (CohortSite cs : COHORT_SITES) {
            if (siteRepository.existsById(cs.id())) continue;
            SiteEntity site = new SiteEntity();
            site.setSiteId(cs.id());
            site.setSiteName(cs.name());
            site.setLocation(cs.location());
            site.setCreatedAt(LocalDateTime.now());
            siteRepository.save(site);
            created++;
        }
        if (created > 0) log.info("DataSeeder: seeded {} Inuka cohort site(s)", created);
        else             log.info("DataSeeder: all cohort sites already present");
    }

    // ── 3. Users ──────────────────────────────────────────────────────────────

    private void seedUsers() {
        log.info("DataSeeder: checking seed accounts...");
        List<SeedAccount> accounts = List.of(
            // ── Legacy accounts (backward compat) ────────────────────────────
            new SeedAccount("Sentinel Admin",    "admin@sentinel.kpc",     "Admin"),
            new SeedAccount("Jane Mwangi",       "manager@sentinel.kpc",   "HSE Manager"),
            new SeedAccount("David Otieno",      "auditor@sentinel.kpc",   "Auditor"),
            new SeedAccount("Amina Kariuki",     "analyst@sentinel.kpc",   "Analyst"),
            new SeedAccount("Tom Kiplangat",     "viewer@sentinel.kpc",    "Viewer"),
            new SeedAccount("Kariuki Wambua",    "tech@sentinel.kpc",      "Field Technician"),
            new SeedAccount("Beatrice Mutua",    "station@sentinel.kpc",   "Station Manager"),
            new SeedAccount("ML Admin User",     "ml.admin@sentinel.kpc",  "ML Admin"),
            // ── Inuka Foundation accounts ─────────────────────────────────────
            new SeedAccount("Inuka Admin",       "admin@inuka.org",        "Admin"),
            new SeedAccount("Grace Wanjiku",     "officer@inuka.org",      "Field Technician"),
            new SeedAccount("Brian Omondi",      "analyst@inuka.org",      "Analyst"),
            new SeedAccount("Esther Adhiambo",   "director@inuka.org",     "HSE Manager"),
            new SeedAccount("ML Admin Inuka",    "ml.admin@inuka.org",     "ML Admin")
        );

        int created = 0;
        for (SeedAccount account : accounts) {
            if (userRepository.existsByEmailIgnoreCase(account.email())) continue;
            AppRoleEntity role = roleRepository.findByNameIgnoreCase(account.role())
                .orElseThrow(() -> new IllegalStateException(
                    "DataSeeder: role '%s' not found".formatted(account.role())));
            AppUserEntity user = new AppUserEntity();
            user.setName(account.name());
            user.setEmail(account.email().toLowerCase());
            user.setPasswordHash(passwordEncoder.encode(DEFAULT_PASSWORD));
            user.setRole(role);
            user.setStatus("Active");
            user.setJoinedAt(LocalDateTime.now());
            userRepository.save(user);
            log.info("DataSeeder: created {} ({}) with role {}", account.name(), account.email(), account.role());
            created++;
        }
        if (created > 0) log.info("DataSeeder: created {} account(s).", created);
        else             log.info("DataSeeder: all seed accounts already present");
    }

    private record SeedAccount(String name, String email, String role) {}
}
