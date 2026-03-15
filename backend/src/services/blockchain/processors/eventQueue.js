/**
 * EventQueue
 *
 * Mục tiêu:
 * - đưa event listener vào hàng đợi
 * - xử lý tuần tự để giảm race condition
 * - tránh việc nhiều event cùng lúc đập thẳng vào DB/processor
 *
 * Lưu ý:
 * - Đây là queue in-memory
 * - Nếu server restart thì queue mất
 * - Phù hợp cho listener runtime cơ bản
 */

class EventQueue {
  constructor({ name = "EventQueue", concurrency = 1 } = {}) {
    this.name = name;
    this.concurrency = Math.max(1, Number(concurrency) || 1);

    this.queue = [];
    this.running = 0;
    this.started = false;
    this.stopped = false;
  }

  /**
   * Thêm job mới vào queue
   *
   * @param {Function} jobFn
   * Hàm async sẽ được chạy sau khi tới lượt
   *
   * @returns {Promise<any>}
   * Promise resolve/reject theo kết quả xử lý job
   */
  enqueue(jobFn) {
    if (typeof jobFn !== "function") {
      return Promise.reject(new Error(`[${this.name}] jobFn must be a function`));
    }

    if (this.stopped) {
      return Promise.reject(new Error(`[${this.name}] queue is stopped`));
    }

    return new Promise((resolve, reject) => {
      this.queue.push({ jobFn, resolve, reject });
      this.start();
      this._drain();
    });
  }

  /**
   * Bắt đầu queue
   */
  start() {
    this.started = true;
    this.stopped = false;
  }

  /**
   * Dừng nhận job mới
   * Job đang chạy vẫn chạy tiếp
   */
  stop() {
    this.stopped = true;
  }

  /**
   * Xóa toàn bộ job chưa chạy
   */
  clear() {
    this.queue = [];
  }

  /**
   * Trả về thông tin hiện tại của queue
   */
  stats() {
    return {
      name: this.name,
      queued: this.queue.length,
      running: this.running,
      concurrency: this.concurrency,
      started: this.started,
      stopped: this.stopped,
    };
  }

  /**
   * Kéo job từ queue ra chạy
   */
  async _drain() {
    if (!this.started || this.stopped) return;

    while (this.running < this.concurrency && this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) return;

      this.running += 1;

      Promise.resolve()
        .then(() => item.jobFn())
        .then((result) => item.resolve(result))
        .catch((error) => item.reject(error))
        .finally(() => {
          this.running -= 1;
          this._drain();
        });
    }
  }
}

/**
 * Tạo 1 singleton queue dùng chung cho blockchain events
 *
 * concurrency = 1:
 * - an toàn hơn
 * - dễ debug
 * - phù hợp giai đoạn đầu
 */
export const blockchainEventQueue = new EventQueue({
  name: "BlockchainEventQueue",
  concurrency: 1,
});

export { EventQueue };