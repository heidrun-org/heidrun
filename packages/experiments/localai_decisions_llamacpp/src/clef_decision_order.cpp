// llama.cpp v0.6.0 declares llama_batch_ext_set_decision_order in src/llama-ext.h, a header that is not
// published and that has no extern "C". The library exports the function with a C++ name, so this file
// declares it with the same C++ signature and gives Rust a C name.
// The declaration must match src/llama-ext.h of the llama.cpp version that llama-cpp-sys-2 builds.

#include <cstdint>

struct llama_batch_ext;

enum llama_decision_order {
    LLAMA_DECISION_ORDER_NONE            = 0,
    LLAMA_DECISION_ORDER_QUESTION_NOUL   = 1,
    LLAMA_DECISION_ORDER_QUESTION_CHOICE = 2,
    LLAMA_DECISION_ORDER_QUESTION_SCORE  = 3,
    LLAMA_DECISION_ORDER_OPTION          = 4,
};

bool llama_batch_ext_set_decision_order(struct llama_batch_ext * batch, int32_t idx, enum llama_decision_order order);

extern "C" bool localai_decisions_set_decision_order(struct llama_batch_ext * batch, int32_t idx, int32_t order) {
    return llama_batch_ext_set_decision_order(batch, idx, static_cast<llama_decision_order>(order));
}
