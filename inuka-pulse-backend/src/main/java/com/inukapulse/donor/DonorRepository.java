package com.inukapulse.donor;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DonorRepository extends JpaRepository<DonorEntity, String> {

    Optional<DonorEntity> findByName(String name);

    List<DonorEntity> findByIsActiveTrue();

    List<DonorEntity> findByOrganizationType(String organizationType);

    List<DonorEntity> findByCountry(String country);

    @Query("SELECT d FROM DonorEntity d WHERE d.isActive = true ORDER BY d.name")
    List<DonorEntity> findAllActiveDonors();

    @Query("SELECT COUNT(d) FROM DonorEntity d WHERE d.isActive = true")
    long countActiveDonors();
}
