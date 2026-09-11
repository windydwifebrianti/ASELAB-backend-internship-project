import axios from "axios";

export async function cekStatusMahasiswa(nim: string): Promise<any> {
  try {
    const url = `https://api.nimfinder.com/search?q=${nim}&limit=1&offset=0`;
    const response = await axios.get(url);

    return response.data;
  } catch (error) {
    console.error("Gagal terhubung ke Nimfinder:", error);
    throw new Error("Layanan verifikasi NIM sedang gangguan, coba lagi nanti.");
  }
}
