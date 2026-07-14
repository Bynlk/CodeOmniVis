plugins {
    kotlin("jvm") version "2.1.0"
    id("org.springframework.boot") version "3.4.0"
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.jetbrains.exposed:exposed-core:0.57.0")
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.0")
    testImplementation("junit:junit:4.13.2")
    testImplementation("io.kotest:kotest-runner-junit5:5.9.1")
}
