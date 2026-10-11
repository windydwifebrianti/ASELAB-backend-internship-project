import axios from "axios";

export async function cekStatusMahasiswa(nim: string): Promise<any> {
  try {
    const response = await axios.get("https://api.nimfinder.com/search", {
      params: {
        q: nim,
        limit: 10,
        offset: 0,
      },
    });

    return response.data;
  } catch (error) {
    console.error("Gagal terhubung ke NIMFinder:", error);

    throw new Error("Layanan verifikasi NIM sedang gangguan, coba lagi nanti.");
  }
}
