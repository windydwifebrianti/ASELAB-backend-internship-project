import { PrismaClient, TempRegistrationStatus } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const password = "Password123!";

const users = [
  ["220001", "alya", "Alya Putri"],
  ["220002", "bagas", "Bagas Pratama"],
  ["220003", "citra", "Citra Lestari"],
  ["220004", "dimas", "Dimas Saputra"],
  ["220005", "elvina", "Elvina Sari"],
  ["220006", "farhan", "Farhan Maulana"],
  ["220007", "gita", "Gita Maharani"],
  ["220008", "hani", "Hani Safitri"],
  ["220009", "indra", "Indra Kurniawan"],
  ["220010", "jihan", "Jihan Azzahra"],
  ["220011", "kevin", "Kevin Wijaya"],
  ["220012", "lara", "Lara Amelia"],
  ["220013", "miko", "Miko Ramadhan"],
  ["220014", "nanda", "Nanda Prameswari"],
  ["220015", "okta", "Okta Firmansyah"],
  ["220016", "putri", "Putri Anindita"],
  ["220017", "qori", "Qori Alfarizi"],
  ["220018", "raka", "Raka Aditya"],
  ["220019", "salsa", "Salsa Nuraini"],
  ["220020", "tio", "Tio Bimantara"],
] as const;

async function clearDatabase() {
  await prisma.$transaction([
    prisma.otp.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.joinRequest.deleteMany(),
    prisma.teamSwipe.deleteMany(),
    prisma.teamMember.deleteMany(),
    prisma.report.deleteMany(),
    prisma.block.deleteMany(),
    prisma.team.deleteMany(),
    prisma.profile.deleteMany(),
    prisma.user.deleteMany(),
    prisma.tempRegistration.deleteMany(),
    prisma.competition.deleteMany(),
  ]);
}

async function main() {
  await clearDatabase();

  const passwordHash = await bcrypt.hash(password, 10);
  const createdUsers = await prisma.$transaction(
    users.map(([nim, username, nama], index) =>
      prisma.user.create({
        data: {
          nim,
          emailInstitusi: `${username}@kampus.ac.id`,
          password: passwordHash,
          nama,
          isVerified: index !== 19,
        },
      }),
    ),
  );

  const userByNim = new Map(createdUsers.map((user) => [user.nim, user]));

  const profiles = [
    ["220001", "Teknik Informatika", ["JavaScript", "UI/UX", "React"], ["Produk digital", "Pendidikan"], "Finalis Hackathon Nasional 2025"],
    ["220002", "Sistem Informasi", ["Python", "Data Analysis", "SQL"], ["Data", "Bisnis"], "Mengerjakan riset analisis data UMKM"],
    ["220003", "Desain Komunikasi Visual", ["Figma", "Branding", "Illustration"], ["Kreatif", "Sosial"], "Juara 2 lomba desain poster kampus"],
    ["220004", "Teknik Elektro", ["Arduino", "IoT", "C++"], ["Robotika", "Energi"], "Membuat prototipe monitoring energi berbasis IoT"],
    ["220005", "Manajemen", ["Marketing", "Business Plan", "Public Speaking"], ["Kewirausahaan", "Ekonomi"], "Peserta kompetisi business plan tingkat nasional"],
    ["220006", "Ilmu Komunikasi", ["Copywriting", "Social Media", "Video Editing"], ["Media", "Komunitas"], "Mengelola konten media sosial organisasi mahasiswa"],
    ["220007", "Teknik Sipil", ["AutoCAD", "Project Management"], ["Infrastruktur", "Lingkungan"], "Relawan perencanaan fasilitas desa"],
    ["220008", "Akuntansi", ["Financial Reporting", "Excel", "Tax"], ["Keuangan", "Investasi"], "Asisten praktikum akuntansi keuangan"],
    ["220009", "Teknik Informatika", ["Backend", "Node.js", "PostgreSQL"], ["Teknologi", "Open Source"], "Kontributor beberapa proyek open source"],
    ["220010", "Psikologi", ["Research", "Interview", "Presentation"], ["Kesehatan mental", "Pendidikan"], "Peneliti pendamping pada survei mahasiswa"],
  ] as const;

  await prisma.profile.createMany({
    data: profiles.map(([nim, jurusan, skill, minat, pengalamanLomba]) => ({
      userId: userByNim.get(nim)!.id,
      jurusan,
      skill,
      minat,
      pengalamanLomba,
    })),
  });

  await prisma.competition.createMany({
    data: [
      {
        namaLomba: "National Software Innovation Challenge",
        penyelenggara: "Kementerian Pendidikan",
        kategori: "Teknologi",
        deadline: new Date("2027-02-15"),
        infoPendaftaran: "Daftar melalui portal resmi dan unggah proposal solusi digital.",
        ketentuan: "Tim terdiri dari 3-5 mahasiswa aktif.",
        biayaPendaftaran: "Gratis",
        hadiah: "Rp25.000.000 dan program inkubasi",
        tingkatLomba: "Nasional",
      },
      {
        namaLomba: "Data for Social Good",
        penyelenggara: "Data Science Indonesia",
        kategori: "Data Science",
        deadline: new Date("2027-01-20"),
        infoPendaftaran: "Kirim notebook analisis dan presentasi solusi berbasis data.",
        ketentuan: "Dataset wajib menggunakan sumber terbuka.",
        biayaPendaftaran: "Gratis",
        hadiah: "Rp15.000.000",
        tingkatLomba: "Nasional",
      },
      {
        namaLomba: "UI/UX Design Sprint",
        penyelenggara: "DesignHub Indonesia",
        kategori: "Desain",
        deadline: new Date("2027-03-05"),
        infoPendaftaran: "Peserta menyelesaikan studi kasus desain dalam waktu 48 jam.",
        ketentuan: "Berkas akhir berupa prototype Figma.",
        biayaPendaftaran: "Rp50.000",
        hadiah: "Laptop dan sertifikat",
        tingkatLomba: "Nasional",
      },
      {
        namaLomba: "Smart City IoT Competition",
        penyelenggara: "Asosiasi IoT Nusantara",
        kategori: "IoT",
        deadline: new Date("2027-02-28"),
        infoPendaftaran: "Daftarkan ide dan demonstrasikan prototype pada babak final.",
        ketentuan: "Prototype harus dapat mendemonstrasikan sensor secara langsung.",
        biayaPendaftaran: "Gratis",
        hadiah: "Rp20.000.000",
        tingkatLomba: "Nasional",
      },
      {
        namaLomba: "Student Business Plan Competition",
        penyelenggara: "Inkubator Wirausaha Kampus",
        kategori: "Bisnis",
        deadline: new Date("2027-01-30"),
        infoPendaftaran: "Unggah ringkasan eksekutif dan proyeksi keuangan usaha.",
        ketentuan: "Ide usaha harus memiliki dampak sosial atau lingkungan.",
        biayaPendaftaran: "Gratis",
        hadiah: "Modal usaha Rp30.000.000",
        tingkatLomba: "Nasional",
      },
      {
        namaLomba: "Short Movie for Change",
        penyelenggara: "Komunitas Film Pelajar",
        kategori: "Multimedia",
        deadline: new Date("2027-04-12"),
        infoPendaftaran: "Kirim film pendek bertema perubahan sosial.",
        ketentuan: "Durasi film 5-12 menit dan belum pernah memenangkan lomba lain.",
        biayaPendaftaran: "Rp75.000",
        hadiah: "Rp10.000.000",
        tingkatLomba: "Nasional",
      },
      {
        namaLomba: "Green Infrastructure Ideas",
        penyelenggara: "Forum Teknik Berkelanjutan",
        kategori: "Lingkungan",
        deadline: new Date("2027-03-18"),
        infoPendaftaran: "Presentasikan gagasan infrastruktur ramah lingkungan.",
        ketentuan: "Proposal mencantumkan estimasi biaya dan dampak lingkungan.",
        biayaPendaftaran: "Gratis",
        hadiah: "Pelatihan dan sertifikat",
        tingkatLomba: "Regional",
      },
      {
        namaLomba: "National Financial Case Competition",
        penyelenggara: "Ikatan Akuntan Muda",
        kategori: "Keuangan",
        deadline: new Date("2027-02-08"),
        infoPendaftaran: "Analisis kasus perusahaan dan presentasikan rekomendasi bisnis.",
        ketentuan: "Peserta wajib mahasiswa aktif.",
        biayaPendaftaran: "Rp100.000",
        hadiah: "Rp18.000.000",
        tingkatLomba: "Nasional",
      },
    ],
  });

  const teamDefinitions = [
    ["220001", "Digital Edukasi Nusantara", "Membangun platform belajar adaptif untuk siswa daerah.", "National Software Innovation Challenge", ["React", "Node.js", "UI/UX"], 5],
    ["220002", "Data Impact Lab", "Menganalisis data kesehatan untuk rekomendasi kebijakan publik.", "Data for Social Good", ["Python", "Data Analysis", "Research"], 4],
    ["220003", "RuangKita", "Mendesain aplikasi komunitas untuk berbagi ruang kreatif.", "UI/UX Design Sprint", ["Figma", "Research", "Branding"], 5],
    ["220004", "Energi Cerdas", "Mengembangkan monitoring konsumsi listrik berbasis IoT.", "Smart City IoT Competition", ["Arduino", "IoT", "Backend"], 5],
    ["220005", "LokalMart", "Membuat model bisnis marketplace produk UMKM lokal.", "Student Business Plan Competition", ["Business Plan", "Marketing", "Financial Reporting"], 5],
    ["220006", "Cerita Berdampak", "Memproduksi film pendek tentang akses pendidikan.", "Short Movie for Change", ["Video Editing", "Copywriting", "Social Media"], 4],
    ["220007", "EcoBuild", "Menyusun solusi material bangunan rendah emisi.", "Green Infrastructure Ideas", ["AutoCAD", "Project Management", "Research"], 5],
    ["220008", "FinSolve", "Menganalisis strategi pertumbuhan perusahaan rintisan.", "National Financial Case Competition", ["Financial Reporting", "Excel", "Presentation"], 4],
  ] as const;

  const teams = await prisma.$transaction(
    teamDefinitions.map(([leaderNim, nama, deskripsi, kompetisi, skillDibutuhkan, kuota]) =>
      prisma.team.create({
        data: {
          nama,
          deskripsi,
          kompetisi,
          skillDibutuhkan,
          kuota,
          leaderId: userByNim.get(leaderNim)!.id,
        },
      }),
    ),
  );

  const memberNims = [
    ["220003", "220004", "220009"],
    ["220008", "220010", "220014"],
    ["220006", "220010", "220016"],
    ["220009", "220012", "220018"],
    ["220011", "220013", "220019"],
    ["220010", "220015", "220017"],
    ["220014", "220018", "220020"],
    ["220011", "220016", "220019"],
  ];

  await prisma.teamMember.createMany({
    data: teams.flatMap((team, index) => [
      { teamId: team.id, userId: team.leaderId, role: "LEADER" },
      ...memberNims[index].map((nim) => ({
        teamId: team.id,
        userId: userByNim.get(nim)!.id,
        role: "MEMBER",
      })),
    ]),
  });

  const swipeDefinitions: Array<[number, number, string]> = [
      [2, 1, "LIKE"], [3, 1, "PASS"], [4, 1, "LIKE"],
      [5, 2, "LIKE"], [6, 2, "PASS"], [7, 2, "LIKE"],
      [8, 3, "LIKE"], [9, 3, "PASS"], [10, 3, "LIKE"],
      [11, 4, "LIKE"], [12, 4, "PASS"], [13, 4, "LIKE"],
      [14, 5, "LIKE"], [15, 5, "PASS"], [16, 5, "LIKE"],
      [17, 6, "LIKE"], [18, 6, "PASS"], [19, 6, "LIKE"],
  ];

  await prisma.teamSwipe.createMany({
    data: swipeDefinitions.map(([userIndex, teamIndex, action]) => ({
      userId: createdUsers[userIndex - 1].id,
      teamId: teams[teamIndex - 1].id,
      action,
    })),
  });

  const joinRequestDefinitions: Array<[number, number, string, string]> = [
      [11, 1, "PENDING", "Saya berpengalaman membangun API dan siap membantu backend."],
      [12, 1, "ACCEPTED", "Saya ingin berkontribusi pada pengembangan produk edukasi."],
      [13, 2, "PENDING", "Saya dapat membantu visualisasi dan presentasi data."],
      [14, 3, "REJECTED", "Tertarik membantu riset pengguna dan validasi ide."],
      [15, 4, "PENDING", "Memiliki pengalaman mengembangkan aplikasi mobile."],
      [16, 5, "ACCEPTED", "Saya dapat membantu strategi pemasaran dan konten."],
      [17, 6, "PENDING", "Siap membantu produksi dan editing film."],
      [18, 7, "PENDING", "Berpengalaman dalam perencanaan proyek."],
      [19, 8, "ACCEPTED", "Saya terbiasa membuat laporan keuangan."],
  ];

  await prisma.joinRequest.createMany({
    data: joinRequestDefinitions.map(([userIndex, teamIndex, status, pesan]) => ({
      userId: createdUsers[userIndex - 1].id,
      teamId: teams[teamIndex - 1].id,
      status,
      pesan,
    })),
  });

  await prisma.report.createMany({
    data: [
      { reporterId: createdUsers[8].id, reportedId: createdUsers[17].id, alasanLaporan: "Mengirim pesan promosi berulang." },
      { reporterId: createdUsers[9].id, reportedId: createdUsers[18].id, alasanLaporan: "Profil berisi informasi yang tidak sesuai." },
      { reporterId: createdUsers[10].id, reportedId: createdUsers[19].id, alasanLaporan: "Menggunakan bahasa yang tidak pantas." },
    ],
  });

  await prisma.block.createMany({
    data: [
      { blockerId: createdUsers[0].id, blockedId: createdUsers[18].id },
      { blockerId: createdUsers[3].id, blockedId: createdUsers[16].id },
      { blockerId: createdUsers[7].id, blockedId: createdUsers[14].id },
    ],
  });

  await prisma.notification.createMany({
    data: createdUsers.slice(0, 12).flatMap((user, index) => [
      {
        userId: user.id,
        title: "Selamat datang di Partnerin!",
        message: "Lengkapi profilmu agar lebih mudah menemukan rekan satu tim.",
        isRead: index % 3 === 0,
      },
      {
        userId: user.id,
        title: index % 2 === 0 ? "Ada tim yang menyukaimu" : "Update permintaan bergabung",
        message: index % 2 === 0
          ? "Ada tim yang sesuai dengan skill-mu. Yuk cek rekomendasinya."
          : "Status permintaan bergabungmu telah diperbarui.",
        isRead: index % 4 === 0,
      },
    ]),
  });

  await prisma.tempRegistration.createMany({
    data: [
      {
        nama: "Vina Maharani",
        nim: "220021",
        email: "vina@kampus.ac.id",
        password: passwordHash,
        token: "seed-token-vina-2026",
        code: "123456",
        attemptCode: 0,
        attemptResend: 1,
        status: TempRegistrationStatus.PENDING,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
      {
        nama: "Wahyu Hidayat",
        nim: "220022",
        email: "wahyu@kampus.ac.id",
        password: passwordHash,
        token: "seed-token-wahyu-2026",
        code: "654321",
        attemptCode: 2,
        attemptResend: 0,
        status: TempRegistrationStatus.FAILED,
        expiresAt: new Date(Date.now() - 30 * 60 * 1000),
      },
    ],
  });

  await prisma.otp.createMany({
    data: [
      {
        email: "alya@kampus.ac.id",
        kodeOtp: "246810",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
      {
        email: "bagas@kampus.ac.id",
        kodeOtp: "135790",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
      {
        email: "citra@kampus.ac.id",
        kodeOtp: "112233",
        expiresAt: new Date(Date.now() - 5 * 60 * 1000),
      },
    ],
  });

  console.log(`Seed selesai: ${createdUsers.length} user, ${teams.length} tim, dan seluruh tabel terisi.`);
  console.log(`Login dummy: alya@kampus.ac.id / ${password}`);
}

main()
  .catch((error) => {
    console.error("Seed gagal:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
